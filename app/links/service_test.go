package links

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestRandomCodeUsesURLSafeAlphabet(t *testing.T) {
	for i := 0; i < 100; i++ {
		code := randomCode(7)
		if len(code) != 7 || strings.ContainsAny(code, "0O1Il /?#") {
			t.Fatalf("unsafe code %q", code)
		}
	}
}

func TestApplyCreatePolicyKeepsBlankVisitLimitUnlimited(t *testing.T) {
	now := time.Date(2026, 8, 9, 12, 0, 0, 0, time.UTC)
	link, err := applyCreatePolicy(Link{Destination: "https://example.com"}, CreatePolicy{
		DefaultDomain:         "go.example",
		DefaultRedirectStatus: 307,
		CodeLength:            9,
		AllowedCharacters:     "abcdef23456789",
		DefaultExpiryDays:     30,
		DefaultClickLimit:     500,
		ForceHTTPS:            true,
	}, now)
	if err != nil {
		t.Fatal(err)
	}
	if link.Domain != "go.example" || link.RedirectStatus != 307 || len(link.Code) != 9 {
		t.Fatalf("safe defaults were not applied: %#v", link)
	}
	if link.MaxClicks != nil {
		t.Fatalf("blank customer visit limit must remain unlimited even when a legacy platform default exists: %#v", link.MaxClicks)
	}
	wantExpiry := now.AddDate(0, 0, 30).Format(time.RFC3339)
	if link.ExpiresAt == nil || *link.ExpiresAt != wantExpiry {
		t.Fatalf("expiry was not applied: %#v", link.ExpiresAt)
	}
}

func TestApplyCreatePolicyPreservesExplicitVisitLimit(t *testing.T) {
	limit := int64(25)
	link, err := applyCreatePolicy(Link{Destination: "https://example.com", Code: "abc", MaxClicks: &limit}, CreatePolicy{}, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if link.MaxClicks == nil || *link.MaxClicks != 25 {
		t.Fatalf("explicit customer visit limit was not preserved: %#v", link.MaxClicks)
	}
}

func TestApplyCreatePolicyRejectsUnsafeOrReservedValues(t *testing.T) {
	policy := CreatePolicy{AllowedCharacters: "abcdef", ReservedCodes: []string{"Admin"}, BlockedKeywords: []string{"spam"}, ForceHTTPS: true}
	for name, link := range map[string]Link{
		"http":     {Destination: "http://example.com", Code: "abc"},
		"alphabet": {Destination: "https://example.com", Code: "abz"},
		"reserved": {Destination: "https://example.com", Code: "ADMIN"},
		"blocked":  {Destination: "https://example.com", Code: "spam"},
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := applyCreatePolicy(link, policy, time.Now()); err == nil {
				t.Fatal("policy violation was accepted")
			}
		})
	}
}
func TestNullableJSON(t *testing.T) {
	if nullableJSON(nil) != nil {
		t.Fatal("empty JSON should be SQL NULL")
	}
	raw := json.RawMessage(`{"a":1}`)
	if nullableJSON(raw) == nil {
		t.Fatal("JSON was discarded")
	}
}

func TestUniqueIDsDropsInvalidAndDuplicateValues(t *testing.T) {
	values := uniqueIDs([]int64{3, 0, 3, -1, 8, 8})
	if len(values) != 2 || values[0] != 3 || values[1] != 8 {
		t.Fatalf("unexpected IDs %#v", values)
	}
}

func TestValidateRoutingRequiresSafeDestinationsAndExactWeights(t *testing.T) {
	rules := json.RawMessage(`[{"dimension":"device","value":"mobile","destination":"https://m.example.com"}]`)
	variants := json.RawMessage(`[{"id":"a","destination":"https://a.example.com","weight":40},{"id":"b","destination":"https://b.example.com","weight":60}]`)
	utm := json.RawMessage(`{"utm_source":"newsletter"}`)
	if err := validateRouting(rules, variants, utm); err != nil {
		t.Fatal(err)
	}
	if err := validateRouting(nil, json.RawMessage(`[{"id":"a","destination":"https://a.example.com","weight":90},{"id":"b","destination":"javascript:alert(1)","weight":10}]`), nil); err == nil {
		t.Fatal("unsafe A/B destination was accepted")
	}
	if err := validateRouting(nil, json.RawMessage(`[{"id":"a","destination":"https://a.example.com","weight":20},{"id":"b","destination":"https://b.example.com","weight":20}]`), nil); err == nil {
		t.Fatal("invalid total weight was accepted")
	}
}

func TestSnapshotExcludesPasswordHashAndPreservesPolicies(t *testing.T) {
	link := Link{Destination: "https://example.com", Title: "campaign", Status: "active", RedirectStatus: 302, PasswordHash: "secret-hash", TagIDs: []int64{3, 3, 8}, UTM: json.RawMessage(`{"utm_source":"email"}`), RoutingRules: json.RawMessage(`[{"dimension":"country","value":"CN","destination":"https://cn.example.com"}]`)}
	raw := snapshot(link)
	if strings.Contains(string(raw), "secret-hash") {
		t.Fatal("password hash leaked into immutable version")
	}
	var decoded map[string]any
	if json.Unmarshal(raw, &decoded) != nil || decoded["password_protected"] != true {
		t.Fatalf("invalid snapshot %s", raw)
	}
	if tags, ok := decoded["tag_ids"].([]any); !ok || len(tags) != 2 {
		t.Fatalf("tags were not normalized: %#v", decoded["tag_ids"])
	}
}

func TestValidateEditableLinkRejectsUnsafeState(t *testing.T) {
	link := Link{Destination: "javascript:alert(1)", Status: "active", RedirectStatus: 302}
	if validateEditableLink(&link) == nil {
		t.Fatal("unsafe destination accepted")
	}
	link = Link{Destination: "https://example.com", Status: "deleted", RedirectStatus: 302}
	if validateEditableLink(&link) == nil {
		t.Fatal("unsupported state accepted")
	}
}
