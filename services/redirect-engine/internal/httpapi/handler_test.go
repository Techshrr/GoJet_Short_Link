package httpapi_test

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/Techshrr/GoJet_Short_Link/services/redirect-engine/internal/domain"
	"github.com/Techshrr/GoJet_Short_Link/services/redirect-engine/internal/httpapi"
	"github.com/Techshrr/GoJet_Short_Link/services/redirect-engine/internal/store"
	"golang.org/x/crypto/bcrypt"
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
	res, err := http.Post(server.URL+"/api/links", "application/json", bytes.NewBufferString(`{"id":"1","code":"x","destination":"javascript:alert(1)"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 400 {
		t.Fatalf("status=%d, want 400", res.StatusCode)
	}
}

func TestBotsAreCountedButExcludedFromUniqueVisitors(t *testing.T) {
	s := store.NewMemory()
	server := httptest.NewServer(httpapi.New(s, "test-secret"))
	defer server.Close()
	createTestLink(t, server.URL)
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	req, _ := http.NewRequest("GET", server.URL+"/go", nil)
	req.Header.Set("User-Agent", "Googlebot/2.1")
	res, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusFound {
		t.Fatalf("status=%d", res.StatusCode)
	}
	statsRes, err := http.Get(server.URL + "/api/links/link-1/stats")
	if err != nil {
		t.Fatal(err)
	}
	defer statsRes.Body.Close()
	var stats struct{ Unique, Bots int64 }
	var raw map[string]json.RawMessage
	_ = json.NewDecoder(statsRes.Body).Decode(&raw)
	_ = json.Unmarshal(raw["unique_visitors"], &stats.Unique)
	_ = json.Unmarshal(raw["bot_visits"], &stats.Bots)
	if stats.Unique != 0 || stats.Bots != 1 {
		t.Fatalf("unique=%d bots=%d", stats.Unique, stats.Bots)
	}
}

func TestTrustedReverseProxyClientIPSeparatesUniqueVisitors(t *testing.T) {
	memory := store.NewMemory()
	server := httptest.NewServer(httpapi.New(memory, "secret"))
	defer server.Close()
	createTestLink(t, server.URL)
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	for _, ip := range []string{"203.0.113.10", "203.0.113.11"} {
		request, _ := http.NewRequest("GET", server.URL+"/go", nil)
		request.Header.Set("X-Real-IP", ip)
		response, err := client.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
	}
	response, err := http.Get(server.URL + "/api/links/link-1/stats")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var stats struct {
		Unique int64 `json:"unique_visitors"`
	}
	if json.NewDecoder(response.Body).Decode(&stats) != nil || stats.Unique != 2 {
		t.Fatalf("unique=%d, want 2", stats.Unique)
	}
}

func TestVisitRateLimitDoesNotPolluteAnalytics(t *testing.T) {
	s := store.NewMemoryWithLimit(3)
	server := httptest.NewServer(httpapi.New(s, "test-secret"))
	defer server.Close()
	createTestLink(t, server.URL)
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	for i := 0; i < 4; i++ {
		res, err := client.Get(server.URL + "/go")
		if err != nil {
			t.Fatal(err)
		}
		if i < 3 && res.StatusCode != 302 {
			t.Fatalf("visit %d status=%d", i, res.StatusCode)
		}
		if i == 3 && res.StatusCode != 429 {
			t.Fatalf("limited status=%d", res.StatusCode)
		}
		res.Body.Close()
	}
	statsRes, err := http.Get(server.URL + "/api/links/link-1/stats")
	if err != nil {
		t.Fatal(err)
	}
	defer statsRes.Body.Close()
	var stats struct {
		Clicks int64 `json:"clicks"`
	}
	_ = json.NewDecoder(statsRes.Body).Decode(&stats)
	if stats.Clicks != 3 {
		t.Fatalf("clicks=%d, want 3", stats.Clicks)
	}
}

func TestOneTimeAndMaximumClickPoliciesAreEnforcedAtomically(t *testing.T) {
	for name, payload := range map[string]string{"one-time": `{"id":"one","code":"once","destination":"https://example.com","one_time":true}`, "maximum": `{"id":"max","code":"twice","destination":"https://example.com","max_clicks":1}`} {
		t.Run(name, func(t *testing.T) {
			server := httptest.NewServer(httpapi.New(store.NewMemory(), "secret"))
			defer server.Close()
			res, err := http.Post(server.URL+"/api/links", "application/json", bytes.NewBufferString(payload))
			if err != nil || res.StatusCode != 201 {
				t.Fatalf("create status=%v err=%v", res.StatusCode, err)
			}
			res.Body.Close()
			client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
			first, _ := client.Get(server.URL + map[string]string{"one-time": "/once", "maximum": "/twice"}[name])
			first.Body.Close()
			if first.StatusCode != 302 {
				t.Fatalf("first status=%d", first.StatusCode)
			}
			second, _ := client.Get(server.URL + map[string]string{"one-time": "/once", "maximum": "/twice"}[name])
			second.Body.Close()
			if second.StatusCode != http.StatusGone {
				t.Fatalf("second status=%d", second.StatusCode)
			}
		})
	}
}
func TestExpiredLinkReturnsGoneWithoutRecording(t *testing.T) {
	server := httptest.NewServer(httpapi.New(store.NewMemory(), "secret"))
	defer server.Close()
	payload := `{"id":"expired","code":"old","destination":"https://example.com","expires_at":"2020-01-01T00:00:00Z"}`
	res, err := http.Post(server.URL+"/api/links", "application/json", bytes.NewBufferString(payload))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	got, err := http.Get(server.URL + "/old")
	if err != nil {
		t.Fatal(err)
	}
	defer got.Body.Close()
	if got.StatusCode != http.StatusGone {
		t.Fatalf("status=%d", got.StatusCode)
	}
}
func TestPasswordProtectedLinkUsesHttpOnlyUnlockCookie(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	memory := store.NewMemory()
	_ = memory.SaveLink(context.Background(), domain.Link{ID: "protected", Code: "secret", Destination: "https://example.com", StatusCode: 302, Active: true, PasswordHash: string(hash)})
	server := httptest.NewServer(httpapi.New(memory, "signing-secret"))
	defer server.Close()
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	locked, err := client.Get(server.URL + "/secret")
	if err != nil {
		t.Fatal(err)
	}
	locked.Body.Close()
	if locked.StatusCode != http.StatusUnauthorized {
		t.Fatalf("locked status=%d", locked.StatusCode)
	}
	response, err := client.PostForm(server.URL+"/secret/unlock", url.Values{"password": {"correct-password"}})
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != http.StatusSeeOther {
		t.Fatalf("unlock status=%d", response.StatusCode)
	}
	cookies := response.Cookies()
	if len(cookies) != 1 || !cookies[0].HttpOnly {
		t.Fatal("unlock cookie must be HttpOnly")
	}
	request, _ := http.NewRequest("GET", server.URL+"/secret", nil)
	request.AddCookie(cookies[0])
	redirected, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	redirected.Body.Close()
	if redirected.StatusCode != http.StatusFound {
		t.Fatalf("redirect status=%d", redirected.StatusCode)
	}
}
func TestCustomDomainsResolveSameCodeIndependently(t *testing.T) {
	memory := store.NewMemory()
	_ = memory.SaveLink(context.Background(), domain.Link{ID: "a", Code: "go", Domain: "a.example", Destination: "https://destination.example/a", StatusCode: 302, Active: true})
	_ = memory.SaveLink(context.Background(), domain.Link{ID: "b", Code: "go", Domain: "b.example", Destination: "https://destination.example/b", StatusCode: 302, Active: true})
	server := httptest.NewServer(httpapi.New(memory, "secret"))
	defer server.Close()
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	for host, want := range map[string]string{"a.example": "https://destination.example/a", "b.example": "https://destination.example/b"} {
		request, _ := http.NewRequest("GET", server.URL+"/go", nil)
		request.Host = host
		response, err := client.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		if response.Header.Get("Location") != want {
			t.Fatalf("host=%s location=%s want=%s", host, response.Header.Get("Location"), want)
		}
	}
}

func TestQRMarkerIsPersistedAsQRVisit(t *testing.T) {
	memory := store.NewMemory()
	server := httptest.NewServer(httpapi.New(memory, "secret"))
	defer server.Close()
	createTestLink(t, server.URL)
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	mac := hmac.New(sha256.New, []byte("secret"))
	_, _ = mac.Write([]byte("link-1||go"))
	response, err := client.Get(server.URL + "/go?_gojet_qr=" + hex.EncodeToString(mac.Sum(nil)))
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	visits := memory.Visits()
	if len(visits) != 1 || visits[0].VisitType != "qr" {
		t.Fatalf("unexpected visits %#v", visits)
	}
}

func TestForgedQRMarkerRemainsNormalRedirect(t *testing.T) {
	memory := store.NewMemory()
	server := httptest.NewServer(httpapi.New(memory, "secret"))
	defer server.Close()
	createTestLink(t, server.URL)
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Get(server.URL + "/go?_gojet_qr=00")
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	visits := memory.Visits()
	if len(visits) != 1 || visits[0].VisitType != "redirect" {
		t.Fatalf("forged marker accepted: %#v", visits)
	}
}

func TestRoutingRuleSelectsDeviceDestinationAndRecordsIt(t *testing.T) {
	memory := store.NewMemory()
	_ = memory.SaveLink(context.Background(), domain.Link{ID: "routing", Code: "route", Destination: "https://example.com/default", StatusCode: 302, Active: true, RoutingRules: []domain.RoutingRule{{Dimension: "device", Value: "mobile", Destination: "https://m.example.com/offer"}}})
	server := httptest.NewServer(httpapi.New(memory, "secret"))
	defer server.Close()
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	request, _ := http.NewRequest("GET", server.URL+"/route", nil)
	request.Header.Set("User-Agent", "Mozilla/5.0 Mobile")
	response, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if got := response.Header.Get("Location"); got != "https://m.example.com/offer" {
		t.Fatalf("location=%s", got)
	}
	if visits := memory.Visits(); len(visits) != 1 || visits[0].DestinationID != "rule-1" {
		t.Fatalf("visits=%#v", visits)
	}
}

func TestABAssignmentIsStableAndConfiguredUTMIsApplied(t *testing.T) {
	memory := store.NewMemoryWithLimit(10)
	link := domain.Link{ID: "experiment", Code: "experiment", Destination: "https://example.com/default", StatusCode: 302, Active: true, UTM: map[string]string{"utm_source": "gojet", "utm_campaign": "launch"}, Destinations: []domain.Destination{{ID: "a", Destination: "https://a.example/landing", Weight: 50}, {ID: "b", Destination: "https://b.example/landing", Weight: 50}}}
	_ = memory.SaveLink(context.Background(), link)
	server := httptest.NewServer(httpapi.New(memory, "secret"))
	defer server.Close()
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	locations := map[string]bool{}
	for i := 0; i < 2; i++ {
		request, _ := http.NewRequest("GET", server.URL+"/experiment", nil)
		request.Header.Set("User-Agent", "stable-browser")
		response, err := client.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		locations[response.Header.Get("Location")] = true
	}
	if len(locations) != 1 {
		t.Fatalf("assignment was not stable: %#v", locations)
	}
	for location := range locations {
		parsed, _ := url.Parse(location)
		if parsed.Query().Get("utm_source") != "gojet" || parsed.Query().Get("utm_campaign") != "launch" {
			t.Fatalf("UTM missing from %s", location)
		}
	}
	visits := memory.Visits()
	if len(visits) != 2 || visits[0].DestinationID != visits[1].DestinationID || visits[0].UTMSource != "gojet" {
		t.Fatalf("unexpected visits %#v", visits)
	}
}

func createTestLink(t *testing.T, baseURL string) {
	t.Helper()
	res, err := http.Post(baseURL+"/api/links", "application/json", bytes.NewBufferString(`{"id":"link-1","code":"go","destination":"https://example.com"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create status=%d", res.StatusCode)
	}
}
