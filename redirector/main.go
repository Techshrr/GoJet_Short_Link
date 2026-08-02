package main

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"time"
)

type config struct {
	listen, spoolDir, controlURL, token        string
	redisAddr, redisUsername, redisPassword    string
	redisPrefix                                string
	redisDB                                    int
	cacheTTL, deliveryInterval, requestTimeout time.Duration
}

func loadConfig() (config, error) {
	c := config{
		listen:           env("GOJET_REDIRECT_LISTEN", ":8081"),
		spoolDir:         env("GOJET_REDIRECT_SPOOL_DIR", "/var/lib/gojet/spool"),
		controlURL:       strings.TrimRight(env("GOJET_CONTROL_PLANE_URL", env("GOJET_REDIRECT_INTERNAL_URL", "http://127.0.0.1")), "/"),
		token:            os.Getenv("GOJET_REDIRECT_INTERNAL_TOKEN"),
		redisAddr:        env("REDIS_ADDR", env("REDIS_HOST", "127.0.0.1")+":"+env("REDIS_PORT", "6379")),
		redisUsername:    optionalEnv("REDIS_USERNAME"),
		redisPassword:    optionalEnv("REDIS_PASSWORD"),
		redisPrefix:      env("REDIS_PREFIX", "gojet-database-"),
		redisDB:          integer("REDIS_DB", 0),
		cacheTTL:         seconds("GOJET_REDIRECT_CACHE_TTL_SECONDS", 3600),
		deliveryInterval: seconds("GOJET_REDIRECT_DELIVERY_INTERVAL_SECONDS", 2),
		requestTimeout:   seconds("GOJET_REDIRECT_REQUEST_TIMEOUT_SECONDS", 5),
	}
	if c.token == "" {
		return c, errors.New("GOJET_REDIRECT_INTERNAL_TOKEN is required")
	}
	if u, err := url.Parse(c.controlURL); err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return c, errors.New("GOJET_CONTROL_PLANE_URL must be an absolute HTTP(S) URL")
	}
	return c, nil
}

func env(k, fallback string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fallback
}
func optionalEnv(k string) string {
	v := strings.TrimSpace(os.Getenv(k))
	if strings.EqualFold(v, "null") {
		return ""
	}
	return v
}
func seconds(k string, fallback int) time.Duration {
	v, e := strconv.Atoi(env(k, strconv.Itoa(fallback)))
	if e != nil || v < 1 {
		v = fallback
	}
	return time.Duration(v) * time.Second
}
func integer(k string, fallback int) int {
	v, e := strconv.Atoi(env(k, strconv.Itoa(fallback)))
	if e != nil || v < 0 {
		return fallback
	}
	return v
}

type linkPayload struct {
	ID                  int64             `json:"id"`
	TargetURL           string            `json:"target_url"`
	RedirectType        int               `json:"redirect_type"`
	Status              string            `json:"status"`
	StartsAt            *time.Time        `json:"starts_at"`
	ExpiresAt           *time.Time        `json:"expires_at"`
	MaxClicks           *int64            `json:"max_clicks"`
	ClicksCount         int64             `json:"clicks_count"`
	RequiresApplication bool              `json:"requires_application"`
	AnalyticsEnabled    bool              `json:"analytics_enabled"`
	UTM                 map[string]string `json:"utm_parameters"`
}

type clickEvent struct {
	EventUUID    string            `json:"event_uuid"`
	LinkID       int64             `json:"link_id"`
	OccurredAt   time.Time         `json:"occurred_at"`
	IP           string            `json:"ip,omitempty"`
	ForwardedFor string            `json:"forwarded_for,omitempty"`
	CountryCode  string            `json:"country_code,omitempty"`
	Region       string            `json:"region,omitempty"`
	City         string            `json:"city,omitempty"`
	Language     string            `json:"language,omitempty"`
	UserAgent    string            `json:"user_agent,omitempty"`
	Referrer     string            `json:"referrer,omitempty"`
	RequestID    string            `json:"request_id,omitempty"`
	Query        map[string]string `json:"query,omitempty"`
}

type resolver interface {
	resolve(context.Context, string, string) (linkPayload, error)
}
type controlResolver struct {
	base, token string
	client      *http.Client
}
type cachedResolver struct {
	cache   *redisClient
	control controlResolver
	ttl     time.Duration
	prefix  string
}

var errNotFound = errors.New("link not found")

func (r controlResolver) resolve(ctx context.Context, host, slug string) (linkPayload, error) {
	u := r.base + "/internal/redirect/resolve?host=" + url.QueryEscape(host) + "&slug=" + url.QueryEscape(slug)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	req.Header.Set("Authorization", "Bearer "+r.token)
	resp, err := r.client.Do(req)
	if err != nil {
		return linkPayload{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return linkPayload{}, errNotFound
	}
	if resp.StatusCode != http.StatusOK {
		io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		return linkPayload{}, fmt.Errorf("resolve returned %d", resp.StatusCode)
	}
	var p linkPayload
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&p); err != nil {
		return p, err
	}
	if err := validatePayload(p); err != nil {
		return linkPayload{}, fmt.Errorf("invalid resolve payload: %w", err)
	}
	return p, nil
}

func (r cachedResolver) resolve(ctx context.Context, host, slug string) (linkPayload, error) {
	key := r.prefix + "gojet:redirect:" + strings.ToLower(host) + ":" + slug
	if data, err := r.cache.get(ctx, key); err == nil && data != "" {
		var p linkPayload
		if json.Unmarshal([]byte(data), &p) == nil && validatePayload(p) == nil {
			return p, nil
		}
	}
	p, err := r.control.resolve(ctx, host, slug)
	if err != nil {
		return p, err
	}
	if data, marshalErr := json.Marshal(p); marshalErr == nil {
		_ = r.cache.setex(ctx, key, data, r.ttl)
	}
	return p, nil
}

type redisClient struct {
	addr, username, password string
	db                       int
	timeout                  time.Duration
}

func (c *redisClient) command(ctx context.Context, args ...string) (string, error) {
	d := net.Dialer{Timeout: c.timeout}
	conn, err := d.DialContext(ctx, "tcp", c.addr)
	if err != nil {
		return "", err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(c.timeout))
	commands := [][]string{}
	if c.password != "" {
		if c.username != "" {
			commands = append(commands, []string{"AUTH", c.username, c.password})
		} else {
			commands = append(commands, []string{"AUTH", c.password})
		}
	}
	if c.db != 0 {
		commands = append(commands, []string{"SELECT", strconv.Itoa(c.db)})
	}
	commands = append(commands, args)
	reader := newRESPReader(conn)
	var result string
	for _, cmd := range commands {
		if _, err = io.WriteString(conn, encodeRESP(cmd)); err != nil {
			return "", err
		}
		result, err = reader.read()
		if err != nil {
			return "", err
		}
	}
	return result, nil
}
func (c *redisClient) get(ctx context.Context, key string) (string, error) {
	return c.command(ctx, "GET", key)
}
func (c *redisClient) setex(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	_, err := c.command(ctx, "SETEX", key, strconv.FormatInt(int64(ttl/time.Second), 10), string(value))
	return err
}

type respReader struct{ r *bufio.Reader }

func newRESPReader(r io.Reader) *respReader { return &respReader{r: bufio.NewReader(r)} }
func (r *respReader) read() (string, error) {
	line, err := r.r.ReadString('\n')
	if err != nil {
		return "", err
	}
	if len(line) < 3 {
		return "", errors.New("invalid redis response")
	}
	payload := strings.TrimSuffix(strings.TrimSuffix(line, "\n"), "\r")
	switch payload[0] {
	case '+':
		return payload[1:], nil
	case '-':
		return "", errors.New(payload[1:])
	case ':':
		return payload[1:], nil
	case '$':
		n, e := strconv.Atoi(payload[1:])
		if e != nil {
			return "", e
		}
		if n < 0 {
			return "", nil
		}
		b := make([]byte, n+2)
		if _, e = io.ReadFull(r.r, b); e != nil {
			return "", e
		}
		return string(b[:n]), nil
	default:
		return "", errors.New("unsupported redis response")
	}
}
func encodeRESP(args []string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "*%d\r\n", len(args))
	for _, arg := range args {
		fmt.Fprintf(&b, "$%d\r\n%s\r\n", len(arg), arg)
	}
	return b.String()
}

type server struct {
	cfg      config
	resolver resolver
	client   *http.Client
	pending  atomic.Int64
	ready    atomic.Bool
}

func (s *server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/healthz" {
		s.health(w)
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	slug := strings.TrimPrefix(r.URL.EscapedPath(), "/")
	if strings.Contains(slug, "/") || !validSlug(slug) {
		http.NotFound(w, r)
		return
	}
	host := strings.ToLower(stripPort(r.Host))
	if host == "" {
		http.NotFound(w, r)
		return
	}
	p, err := s.resolver.resolve(r.Context(), host, slug)
	if errors.Is(err, errNotFound) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		http.Error(w, "redirect service unavailable", http.StatusServiceUnavailable)
		return
	}
	now := time.Now().UTC()
	if p.RequiresApplication {
		http.NotFound(w, r)
		return
	}
	if p.Status != "active" || (p.StartsAt != nil && now.Before(*p.StartsAt)) {
		http.NotFound(w, r)
		return
	}
	if (p.ExpiresAt != nil && !now.Before(*p.ExpiresAt)) || (p.MaxClicks != nil && p.ClicksCount >= *p.MaxClicks) {
		http.Error(w, "link expired", http.StatusGone)
		return
	}
	target, err := targetURL(p.TargetURL, p.UTM, r.URL.Query())
	if err != nil {
		http.Error(w, "invalid target", http.StatusServiceUnavailable)
		return
	}
	if p.AnalyticsEnabled {
		e := eventFromRequest(r, p.ID, now)
		if err := writeSpool(s.cfg.spoolDir, e); err != nil {
			log.Printf("spool write failed: %v", err)
			http.Error(w, "analytics spool unavailable", http.StatusServiceUnavailable)
			return
		}
		s.pending.Add(1)
	}
	code := p.RedirectType
	if code != 301 && code != 302 && code != 307 && code != 308 {
		code = 302
	}
	w.Header().Set("Cache-Control", "private, no-store, max-age=0")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
	w.Header().Set("X-Robots-Tag", "noindex, nofollow")
	http.Redirect(w, r, target, code)
}

func (s *server) health(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	status := http.StatusOK
	state := "ok"
	if !s.ready.Load() {
		status = http.StatusServiceUnavailable
		state = "starting"
	}
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"status": state, "pending_events": s.pending.Load()})
}

func validSlug(v string) bool {
	if len(v) < 3 || len(v) > 64 {
		return false
	}
	for _, c := range v {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '_' || c == '-') {
			return false
		}
	}
	return true
}
func stripPort(v string) string {
	if h, _, e := net.SplitHostPort(v); e == nil {
		return h
	}
	return strings.TrimSuffix(strings.TrimPrefix(v, "["), "]")
}

func targetURL(raw string, utm map[string]string, incoming url.Values) (string, error) {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return "", errors.New("invalid target")
	}
	q := u.Query()
	utmAliases := map[string]string{
		"utm_source":   "source",
		"utm_medium":   "medium",
		"utm_campaign": "campaign",
		"utm_content":  "content",
		"utm_term":     "term",
	}
	for key, alias := range utmAliases {
		value := utm[key]
		if value == "" {
			value = utm[alias]
		}
		if value != "" && !q.Has(key) {
			q.Set(key, value)
		}
	}
	for k, values := range incoming {
		if k == "" || q.Has(k) {
			continue
		}
		for _, value := range values {
			q.Add(k, value)
		}
	}
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func validatePayload(p linkPayload) error {
	if p.ID < 1 {
		return errors.New("id must be positive")
	}
	if _, err := targetURL(p.TargetURL, nil, nil); err != nil {
		return errors.New("target_url must be an absolute HTTP(S) URL")
	}
	return nil
}

func eventFromRequest(r *http.Request, linkID int64, now time.Time) clickEvent {
	q := map[string]string{}
	for k, v := range r.URL.Query() {
		if len(v) > 0 {
			q[k] = truncate(v[0], 500)
		}
	}
	lang := strings.Split(strings.Split(r.Header.Get("Accept-Language"), ",")[0], "-")[0]
	return clickEvent{EventUUID: uuid(), LinkID: linkID, OccurredAt: now, IP: truncate(r.Header.Get("X-Real-IP"), 45), ForwardedFor: truncate(r.Header.Get("X-Forwarded-For"), 1000), CountryCode: country(r.Header.Get("CF-IPCountry")), Region: truncate(first(r.Header.Get("CF-Region"), r.Header.Get("X-GoJet-Region")), 120), City: truncate(first(r.Header.Get("CF-IPCity"), r.Header.Get("X-GoJet-City")), 120), Language: truncate(strings.ToLower(lang), 20), UserAgent: truncate(r.UserAgent(), 1000), Referrer: truncate(r.Referer(), 2048), RequestID: truncate(r.Header.Get("X-Request-ID"), 120), Query: q}
}
func first(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
func truncate(v string, n int) string {
	r := []rune(v)
	if len(r) > n {
		return string(r[:n])
	}
	return v
}
func country(v string) string {
	v = strings.ToUpper(v)
	if len(v) == 2 && v != "XX" {
		return v
	}
	return ""
}
func uuid() string {
	var b [16]byte
	if _, e := rand.Read(b[:]); e != nil {
		panic(e)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	h := hex.EncodeToString(b[:])
	return h[:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:]
}

func writeSpool(dir string, event clickEvent) error {
	if err := os.MkdirAll(dir, 0750); err != nil {
		return err
	}
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".pending-")
	if err != nil {
		return err
	}
	name := tmp.Name()
	ok := false
	defer func() {
		tmp.Close()
		if !ok {
			os.Remove(name)
		}
	}()
	if err = tmp.Chmod(0640); err == nil {
		_, err = tmp.Write(append(data, '\n'))
	}
	if err == nil {
		err = tmp.Sync()
	}
	if closeErr := tmp.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	final := filepath.Join(dir, event.EventUUID+".json")
	if err = os.Rename(name, final); err != nil {
		return err
	}
	d, err := os.Open(dir)
	if err == nil {
		err = d.Sync()
		d.Close()
	}
	if err != nil {
		return err
	}
	ok = true
	return nil
}

func (s *server) deliver(ctx context.Context) {
	ticker := time.NewTicker(s.cfg.deliveryInterval)
	defer ticker.Stop()
	for {
		s.deliverBatch(ctx)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
func (s *server) deliverBatch(ctx context.Context) {
	entries, err := filepath.Glob(filepath.Join(s.cfg.spoolDir, "*.json"))
	if err != nil {
		return
	}
	s.pending.Store(int64(len(entries)))
	for _, name := range entries {
		select {
		case <-ctx.Done():
			return
		default:
		}
		data, err := os.ReadFile(name)
		if err != nil {
			continue
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.controlURL+"/api/internal/v1/click", strings.NewReader(string(data)))
		if err != nil {
			continue
		}
		req.Header.Set("Authorization", "Bearer "+s.cfg.token)
		req.Header.Set("Content-Type", "application/json")
		resp, err := s.client.Do(req)
		if err != nil {
			continue
		}
		io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		resp.Body.Close()
		if resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusMultipleChoices || resp.StatusCode == http.StatusConflict {
			if os.Remove(name) == nil {
				s.pending.Add(-1)
			}
		} else if resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusUnprocessableEntity {
			if err := quarantineSpool(s.cfg.spoolDir, name); err != nil {
				log.Printf("failed to quarantine rejected event %s: %v", filepath.Base(name), err)
			} else {
				s.pending.Add(-1)
			}
		}
	}
}

func quarantineSpool(spoolDir, name string) error {
	failedDir := filepath.Join(spoolDir, "failed")
	if err := os.MkdirAll(failedDir, 0750); err != nil {
		return err
	}
	return os.Rename(name, filepath.Join(failedDir, filepath.Base(name)))
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		log.Fatal(err)
	}
	if err = os.MkdirAll(cfg.spoolDir, 0750); err != nil {
		log.Fatal(err)
	}
	client := &http.Client{Timeout: cfg.requestTimeout}
	s := &server{cfg: cfg, client: client}
	control := controlResolver{base: cfg.controlURL, token: cfg.token, client: client}
	s.resolver = cachedResolver{cache: &redisClient{addr: cfg.redisAddr, username: cfg.redisUsername, password: cfg.redisPassword, db: cfg.redisDB, timeout: cfg.requestTimeout}, control: control, ttl: cfg.cacheTTL, prefix: cfg.redisPrefix}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	s.ready.Store(true)
	go s.deliver(ctx)
	httpServer := &http.Server{Addr: cfg.listen, Handler: s, ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 1 << 20}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		_ = httpServer.Shutdown(shutdownCtx)
	}()
	log.Printf("GoJet redirector listening on %s", cfg.listen)
	if err = httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
