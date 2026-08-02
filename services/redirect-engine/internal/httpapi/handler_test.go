package httpapi_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Techshrr/GoJet_Short_Link/services/redirect-engine/internal/httpapi"
	"github.com/Techshrr/GoJet_Short_Link/services/redirect-engine/internal/store"
)

func TestRedirectImmediatelyUpdatesRealStats(t *testing.T) {
	s := store.NewMemory()
	server := httptest.NewServer(httpapi.New(s, "test-secret"))
	defer server.Close()
	payload := []byte(`{"id":"link-1","code":"go","destination":"https://example.com/product","status_code":302}`)
	res, err := http.Post(server.URL+"/api/links", "application/json", bytes.NewReader(payload))
	if err != nil || res.StatusCode != 201 {
		t.Fatalf("create: status=%v err=%v", res.StatusCode, err)
	}
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	for i := 0; i < 10; i++ {
		req, _ := http.NewRequest("GET", server.URL+"/go?utm_source=test", nil)
		req.Header.Set("User-Agent", "Chrome/130 Windows")
		got, e := client.Do(req)
		if e != nil || got.StatusCode != 302 {
			t.Fatalf("redirect %d: status=%v err=%v", i, got.StatusCode, e)
		}
	}
	got, _ := http.Get(server.URL + "/api/links/link-1/stats")
	var stats struct {
		Clicks int64 `json:"clicks"`
		Unique int64 `json:"unique_visitors"`
	}
	_ = json.NewDecoder(got.Body).Decode(&stats)
	if stats.Clicks != 10 {
		t.Fatalf("clicks=%d, want 10", stats.Clicks)
	}
	if stats.Unique != 1 {
		t.Fatalf("unique=%d, want 1", stats.Unique)
	}
}
func TestRejectsUnsafeDestination(t *testing.T) {
	server := httptest.NewServer(httpapi.New(store.NewMemory(), "secret"))
	defer server.Close()
	res, _ := http.Post(server.URL+"/api/links", "application/json", bytes.NewBufferString(`{"id":"1","code":"x","destination":"javascript:alert(1)"}`))
	if res.StatusCode != 400 {
		t.Fatalf("status=%d, want 400", res.StatusCode)
	}
}
