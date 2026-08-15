package store

import (
	"strings"
	"testing"

	"github.com/Techshrr/GoJet_Short_Link/app/destinationkey"
	"github.com/Techshrr/GoJet_Short_Link/services/redirectengine/internal/domain"
)

func TestRiskDecisionUsesBrandedFailClosedInterstitial(t *testing.T) {
	t.Setenv("PUBLIC_BASE_URL", "https://gojet.example")
	cases := []struct {
		name       string
		raw        any
		wantTarget string
	}{
		{"review", "review", "reason=review"},
		{"block", "block", "reason=blocked"},
		{"missing", nil, "reason=review"},
		{"unknown", "unknown", "reason=review"},
		{"wrong-type", int64(1), "reason=review"},
	}
	for _, item := range cases {
		t.Run(item.name, func(t *testing.T) {
			link := domain.Link{ID: "42", Code: "go", Destination: "https://example.com", StatusCode: 301, Active: true, RoutingRules: []domain.RoutingRule{{Dimension: "country", Value: "US", Destination: "https://example.com/us"}}, Destinations: []domain.Destination{{ID: "a", Destination: "https://example.com/a", Weight: 100}}, UTM: map[string]string{"utm_source": "test"}}
			enforceRiskDecision(&link, item.raw)
			if !link.Active {
				t.Fatalf("risk interstitial should remain routable for %#v", item.raw)
			}
			if !strings.HasPrefix(link.Destination, "https://gojet.example/linkunavailable?") || !strings.Contains(link.Destination, item.wantTarget) || !strings.Contains(link.Destination, "code=go") {
				t.Fatalf("unexpected safety destination: %s", link.Destination)
			}
			if link.StatusCode != 302 || len(link.RoutingRules) != 0 || len(link.Destinations) != 0 || len(link.UTM) != 0 {
				t.Fatalf("risk interstitial must bypass smart routing and tracking parameters: %#v", link)
			}
		})
	}
}

func TestRiskAllowAndOperationalPauseRemainDistinct(t *testing.T) {
	t.Setenv("PUBLIC_BASE_URL", "https://gojet.example")
	allowed := domain.Link{ID: "42", Code: "go", Destination: "https://example.com", StatusCode: 301, Active: true}
	enforceRiskDecision(&allowed, "allow")
	if !allowed.Active || allowed.Destination != "https://example.com" || allowed.StatusCode != 301 {
		t.Fatalf("allow decision changed a safe link: %#v", allowed)
	}

	paused := domain.Link{ID: "42", Code: "go", Destination: "https://example.com", Active: false}
	enforceRiskDecision(&paused, "block")
	if paused.Active || paused.Destination != "https://example.com" {
		t.Fatalf("operational pause must not be rewritten as risk interstitial: %#v", paused)
	}
}

func TestRiskDecisionWithoutPublicBaseStillFailsClosed(t *testing.T) {
	t.Setenv("PUBLIC_BASE_URL", "")
	link := domain.Link{ID: "42", Code: "go", Destination: "https://example.com", Active: true}
	enforceRiskDecision(&link, "block")
	if link.Active {
		t.Fatal("missing interstitial configuration must not reopen a blocked destination")
	}
}

func TestReachableTargetFingerprintChangesForRoutingAndABEdits(t *testing.T) {
	base := domain.Link{
		ID:          "42",
		Destination: "https://example.com/main",
		RoutingRules: []domain.RoutingRule{{Dimension: "country", Value: "US", Destination: "https://example.com/us"}},
		Destinations: []domain.Destination{{ID: "a", Destination: "https://example.com/a", Weight: 50}, {ID: "b", Destination: "https://example.com/b", Weight: 50}},
	}
	fingerprint := destinationkey.Fingerprint(reachableTargets(base))
	if fingerprint == "" {
		t.Fatal("fingerprint must not be empty")
	}

	routingChanged := base
	routingChanged.RoutingRules = []domain.RoutingRule{{Dimension: "country", Value: "US", Destination: "https://evil.example/us"}}
	if destinationkey.Fingerprint(reachableTargets(routingChanged)) == fingerprint {
		t.Fatal("routing destination change must invalidate risk fingerprint")
	}

	abChanged := base
	abChanged.Destinations = []domain.Destination{{ID: "a", Destination: "https://evil.example/a", Weight: 50}, {ID: "b", Destination: "https://example.com/b", Weight: 50}}
	if destinationkey.Fingerprint(reachableTargets(abChanged)) == fingerprint {
		t.Fatal("A/B destination change must invalidate risk fingerprint")
	}

	reordered := base
	reordered.Destinations = []domain.Destination{{ID: "b", Destination: "https://example.com/b", Weight: 50}, {ID: "a", Destination: "https://example.com/a", Weight: 50}}
	if destinationkey.Fingerprint(reachableTargets(reordered)) != fingerprint {
		t.Fatal("reordering the same reachable target set must not invalidate risk fingerprint")
	}
}