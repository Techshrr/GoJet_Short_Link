package observability

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"regexp"
	"sync"
	"time"
)

type contextKey struct{}

var validID = regexp.MustCompile(`^[A-Za-z0-9_-]{16,64}$`)

func RequestID(ctx context.Context) string { id, _ := ctx.Value(contextKey{}).(string); return id }
func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, contextKey{}, id)
}
func NewRequestID() string {
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return time.Now().UTC().Format("20060102150405.000000000")
	}
	return hex.EncodeToString(raw)
}

type Logger struct {
	service string
	writer  io.Writer
	mu      sync.Mutex
}

func NewLogger(service string, writer io.Writer) *Logger {
	return &Logger{service: service, writer: writer}
}
func WriterFromEnvironment() io.Writer {
	if endpoint := os.Getenv("LOG_WEBHOOK_URL"); endpoint != "" {
		writer := NewAsyncWebhookWriter(endpoint, 512)
		writer.target.Token = os.Getenv("LOG_WEBHOOK_TOKEN")
		return io.MultiWriter(os.Stdout, writer)
	}
	return os.Stdout
}
func (l *Logger) Event(ctx context.Context, level, event string, fields map[string]any) {
	record := map[string]any{"timestamp": time.Now().UTC().Format(time.RFC3339Nano), "service": l.service, "level": level, "event": event}
	if id := RequestID(ctx); id != "" {
		record["request_id"] = id
	}
	for key, value := range fields {
		record[key] = value
	}
	line, _ := json.Marshal(record)
	l.mu.Lock()
	defer l.mu.Unlock()
	_, _ = l.writer.Write(append(line, '\n'))
}

type statusWriter struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}
func (w *statusWriter) Write(payload []byte) (int, error) {
	if w.status == 0 {
		w.status = 200
	}
	n, err := w.ResponseWriter.Write(payload)
	w.bytes += n
	return n, err
}

func (l *Logger) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if !validID.MatchString(id) {
			id = NewRequestID()
		}
		ctx := WithRequestID(r.Context(), id)
		r = r.WithContext(ctx)
		r.Header.Set("X-Request-ID", id)
		w.Header().Set("X-Request-ID", id)
		tracked := &statusWriter{ResponseWriter: w}
		start := time.Now()
		next.ServeHTTP(tracked, r)
		l.Event(ctx, "info", "http.request", map[string]any{"method": r.Method, "path": r.URL.Path, "status": tracked.status, "response_bytes": tracked.bytes, "duration_ms": time.Since(start).Milliseconds(), "remote_addr": r.RemoteAddr})
	})
}

type WebhookWriter struct {
	URL    string
	Token  string
	Client *http.Client
}

type AsyncWebhookWriter struct {
	queue  chan []byte
	target WebhookWriter
}

func NewAsyncWebhookWriter(url string, capacity int) *AsyncWebhookWriter {
	w := &AsyncWebhookWriter{queue: make(chan []byte, capacity), target: WebhookWriter{URL: url, Client: &http.Client{Timeout: 2 * time.Second}}}
	go w.run()
	return w
}
func (w *AsyncWebhookWriter) Write(payload []byte) (int, error) {
	copyOfPayload := append([]byte(nil), payload...)
	select {
	case w.queue <- copyOfPayload:
	default:
	}
	return len(payload), nil
}
func (w *AsyncWebhookWriter) run() {
	for payload := range w.queue {
		_, _ = w.target.Write(payload)
	}
}

func (w WebhookWriter) Write(payload []byte) (int, error) {
	request, err := http.NewRequest(http.MethodPost, w.URL, bytes.NewReader(payload))
	if err != nil {
		return 0, err
	}
	request.Header.Set("Content-Type", "application/x-ndjson")
	if w.Token != "" {
		request.Header.Set("Authorization", "Bearer "+w.Token)
	}
	response, err := w.Client.Do(request)
	if err != nil {
		return 0, err
	}
	defer response.Body.Close()
	if response.StatusCode >= 300 {
		return 0, io.ErrUnexpectedEOF
	}
	return len(payload), nil
}
