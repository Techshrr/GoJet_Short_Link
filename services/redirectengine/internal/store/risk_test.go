package store

import (
	"testing"

	"github.com/Techshrr/GoJet_Short_Link/app/destinationkey"
	"github.com/Techshrr/GoJet_Short_Link/services/redirectengine/internal/domain"
)

func TestRiskDecisionFailsClosed(t *testing.T) {
	cases := []struct {
		name     string
		raw      any
		wantLive bool
	}{
		{"allow", "allow", true},
		{"review", "review", false},
		{"block", "block", false},
		{"missing", nil, false},
		{"unknown", "unknown", false},
		{"wrong-type", int64(1), false},
	}
	for _, item := range cases {
		t.Run(item.name, func(t *testing.T) {
			link := domain.Link{ID: "42", Code: "go", Destination: "https://example.com", Active: true}
			enforceRiskDecision(&link, item.raw)
			if link.Active != item.wantLive {
				t.Fatalf("decision %#v active=%v want %v", item.raw, link.Active, item.wantLive)
			}
		})
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
