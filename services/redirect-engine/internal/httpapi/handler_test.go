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
	res.Body.Close()
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	for i := 0; i < 10; i++ {
		req, _ := http.NewRequest("GET", server.URL+"/go?utm_source=test", nil)
		req.Header.Set("User-Agent", "Chrome/130 Windows")
		got, e := client.Do(req)
		if e != nil || got.StatusCode != 302 {
			t.Fatalf("redirect %d: status=%v err=%v", i, got.StatusCode, e)
		}
		got.Body.Close()
	}
	got, _ := http.Get(server.URL + "/api/links/link-1/stats")
	var stats struct {
		Clicks    int64            `json:"clicks"`
		Today     int64            `json:"today_clicks"`
		Unique    int64            `json:"unique_visitors"`
		BotVisits int64            `json:"bot_visits"`
		Sources   map[string]int64 `json:"sources"`
		Devices   map[string]int64 `json:"devices"`
		Browsers  map[string]int64 `json:"browsers"`
	}
	_ = json.NewDecoder(got.Body).Decode(&stats)
	got.Body.Close()
	if stats.Clicks != 10 {
		t.Fatalf("clicks=%d, want 10", stats.Clicks)
	}
	if stats.Unique != 1 {
		t.Fatalf("unique=%d, want 1", stats.Unique)
	}
	if stats.Today != 10 || stats.Sources["direct"] != 10 || stats.Devices["desktop"] != 10 || stats.Browsers["chrome"] != 10 {
		t.Fatalf("unexpected dimensions: %+v", stats)
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

func TestBotsAreCountedButExcludedFromUniqueVisitors(t *testing.T) {
	s := store.NewMemory()
	server := httptest.NewServer(httpapi.New(s, "test-secret"))
	defer server.Close()
	_, _ = http.Post(server.URL+"/api/links", "application/json", bytes.NewBufferString(`{"id":"link-1","code":"go","destination":"https://example.com"}`))
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	req, _ := http.NewRequest("GET", server.URL+"/go", nil)
	req.Header.Set("User-Agent", "Googlebot/2.1")
	res, _ := client.Do(req)
	defer res.Body.Close()
	if res.StatusCode != http.StatusFound {
		t.Fatalf("status=%d", res.StatusCode)
	}
	statsRes, _ := http.Get(server.URL + "/api/links/link-1/stats")
	var stats struct{ Unique, Bots int64 }
	var raw map[string]json.RawMessage
	_ = json.NewDecoder(statsRes.Body).Decode(&raw)
	_ = json.Unmarshal(raw["unique_visitors"], &stats.Unique)
	_ = json.Unmarshal(raw["bot_visits"], &stats.Bots)
	if stats.Unique != 0 || stats.Bots != 1 {
		t.Fatalf("unique=%d bots=%d", stats.Unique, stats.Bots)
	}
}

func TestVisitRateLimitDoesNotPolluteAnalytics(t *testing.T) {
	s := store.NewMemoryWithLimit(3)
	server := httptest.NewServer(httpapi.New(s, "test-secret"))
	defer server.Close()
	_, _ = http.Post(server.URL+"/api/links", "application/json", bytes.NewBufferString(`{"id":"link-1","code":"go","destination":"https://example.com"}`))
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	for i := 0; i < 4; i++ {
		res, _ := client.Get(server.URL + "/go")
		if i < 3 && res.StatusCode != 302 {
			t.Fatalf("visit %d status=%d", i, res.StatusCode)
		}
		if i == 3 && res.StatusCode != 429 {
			t.Fatalf("limited status=%d", res.StatusCode)
		}
		res.Body.Close()
	}
	statsRes, _ := http.Get(server.URL + "/api/links/link-1/stats")
	var stats struct {
		Clicks int64 `json:"clicks"`
	}
	_ = json.NewDecoder(statsRes.Body).Decode(&stats)
	if stats.Clicks != 3 {
		t.Fatalf("clicks=%d, want 3", stats.Clicks)
	}
}
