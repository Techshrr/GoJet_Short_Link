package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

type fakeResolver struct {
	payload linkPayload
	err     error
}

func (f fakeResolver) resolve(context.Context, string, string) (linkPayload, error) {
	return f.payload, f.err
}

func TestRedirectSpoolsBeforeResponse(t *testing.T) {
	dir := t.TempDir()
	s := &server{cfg: config{spoolDir: dir}, resolver: fakeResolver{payload: linkPayload{ID: 7, TargetURL: "https://example.com/path?existing=1", RedirectType: 302, Status: "active", AnalyticsEnabled: true, UTM: map[string]string{"utm_source": "gojet"}}}}
	r := httptest.NewRequest(http.MethodGet, "http://gojet.cc/abc?campaign=summer", nil)
	r.Header.Set("X-Real-IP", "203.0.113.2")
	w := httptest.NewRecorder()
	s.ServeHTTP(w, r)
	if w.Code != 302 {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if got := w.Header().Get("Location"); got != "https://example.com/path?campaign=summer&existing=1&utm_source=gojet" {
		t.Fatalf("location=%s", got)
	}
	files, _ := filepath.Glob(filepath.Join(dir, "*.json"))
	if len(files) != 1 {
		t.Fatalf("spool files=%d", len(files))
	}
	var e clickEvent
	b, _ := os.ReadFile(files[0])
	if err := json.Unmarshal(b, &e); err != nil || e.LinkID != 7 || e.IP != "203.0.113.2" {
		t.Fatalf("event=%+v err=%v", e, err)
	}
}

func TestApplicationLinkFallsBackWithoutSpool(t *testing.T) {
	dir := t.TempDir()
	s := &server{cfg: config{spoolDir: dir}, resolver: fakeResolver{payload: linkPayload{ID: 8, TargetURL: "https://example.com", Status: "active", RequiresApplication: true, AnalyticsEnabled: true}}}
	w := httptest.NewRecorder()
	s.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "http://gojet.cc/abc", nil))
	if w.Code != 404 {
		t.Fatalf("status=%d", w.Code)
	}
	files, _ := filepath.Glob(filepath.Join(dir, "*.json"))
	if len(files) != 0 {
		t.Fatal("application link must not spool")
	}
}

func TestExpiredLinkIsGone(t *testing.T) {
	past := time.Now().Add(-time.Minute)
	s := &server{cfg: config{spoolDir: t.TempDir()}, resolver: fakeResolver{payload: linkPayload{TargetURL: "https://example.com", Status: "active", ExpiresAt: &past}}}
	w := httptest.NewRecorder()
	s.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "http://gojet.cc/abc", nil))
	if w.Code != 410 {
		t.Fatalf("status=%d", w.Code)
	}
}

func TestSpoolFailureReturns503(t *testing.T) {
	file := filepath.Join(t.TempDir(), "file")
	_ = os.WriteFile(file, []byte("x"), 0600)
	s := &server{cfg: config{spoolDir: file}, resolver: fakeResolver{payload: linkPayload{ID: 1, TargetURL: "https://example.com", Status: "active", AnalyticsEnabled: true}}}
	w := httptest.NewRecorder()
	s.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "http://gojet.cc/abc", nil))
	if w.Code != 503 {
		t.Fatalf("status=%d", w.Code)
	}
}

func TestDeliveryDeletesCreatedAndDuplicate(t *testing.T) {
	for _, status := range []int{201, 409} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			dir := t.TempDir()
			e := clickEvent{EventUUID: uuid(), LinkID: 1, OccurredAt: time.Now().UTC()}
			if err := writeSpool(dir, e); err != nil {
				t.Fatal(err)
			}
			api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Header.Get("Authorization") != "Bearer secret" {
					t.Error("missing token")
				}
				w.WriteHeader(status)
			}))
			defer api.Close()
			s := &server{cfg: config{spoolDir: dir, controlURL: api.URL, token: "secret"}, client: api.Client()}
			s.deliverBatch(context.Background())
			files, _ := filepath.Glob(filepath.Join(dir, "*.json"))
			if len(files) != 0 {
				t.Fatalf("remaining=%d", len(files))
			}
		})
	}
}
