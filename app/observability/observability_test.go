package observability

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMiddlewarePropagatesValidRequestIDAndLogsJSON(t *testing.T) {
	var output bytes.Buffer
	logger := NewLogger("platform-api", &output)
	handler := logger.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if RequestID(r.Context()) != "client-request-1234" {
			t.Fatal("request id missing from context")
		}
		w.WriteHeader(201)
	}))
	request := httptest.NewRequest("POST", "/api/links", nil)
	request.Header.Set("X-Request-ID", "client-request-1234")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Header().Get("X-Request-ID") != "client-request-1234" {
		t.Fatal("response request id missing")
	}
	var record map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(output.Bytes()), &record); err != nil {
		t.Fatal(err)
	}
	if record["service"] != "platform-api" || record["status"] != float64(201) {
		t.Fatalf("record=%v", record)
	}
}

func TestMiddlewareReplacesUnsafeRequestID(t *testing.T) {
	logger := NewLogger("redirect", io.Discard)
	handler := logger.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }))
	request := httptest.NewRequest("GET", "/x", nil)
	request.Header.Set("X-Request-ID", "bad id with spaces")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if validID.MatchString("bad id with spaces") || !validID.MatchString(response.Header().Get("X-Request-ID")) {
		t.Fatal("unsafe request id was not replaced")
	}
}

func TestWebhookWriterPostsNDJSON(t *testing.T) {
	received := make(chan string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload, _ := io.ReadAll(r.Body)
		received <- string(payload)
		w.WriteHeader(http.StatusAccepted)
	}))
	defer server.Close()
	writer := WebhookWriter{URL: server.URL, Client: server.Client()}
	if _, err := writer.Write([]byte("{\"event\":\"test\"}\n")); err != nil {
		t.Fatal(err)
	}
	if payload := <-received; payload != "{\"event\":\"test\"}\n" {
		t.Fatalf("payload=%q", payload)
	}
}
