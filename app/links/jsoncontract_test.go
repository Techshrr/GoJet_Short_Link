package links

import (
	"encoding/json"
	"testing"
)

func TestOptionalAdvancedLinkJSONIsDisabledWhenEmpty(t *testing.T) {
	var link Link
	if err := json.Unmarshal([]byte(`{"Destination":"https://example.com","routing_rules":[],"ab_destinations":[],"utm":{},"max_clicks":null,"one_time":false}`), &link); err != nil {
		t.Fatal(err)
	}
	if link.RoutingRules != nil || link.ABDestinations != nil || link.UTM != nil {
		t.Fatalf("empty advanced options must normalize to nil: routing=%q ab=%q utm=%q", link.RoutingRules, link.ABDestinations, link.UTM)
	}
	if link.MaxClicks != nil {
		t.Fatalf("blank max-click limit must remain unlimited, got %v", *link.MaxClicks)
	}
	if err := validateRouting(link.RoutingRules, link.ABDestinations, link.UTM); err != nil {
		t.Fatalf("blank advanced options must not enable validation: %v", err)
	}
}

func TestOptionalAdvancedLinkJSONStillValidatesConfiguredAB(t *testing.T) {
	var link Link
	if err := json.Unmarshal([]byte(`{"Destination":"https://example.com","ab_destinations":[{"id":"a","destination":"https://a.example.com","weight":100}]}`), &link); err != nil {
		t.Fatal(err)
	}
	if link.ABDestinations == nil {
		t.Fatal("configured A/B destinations must not be discarded")
	}
	if err := validateRouting(link.RoutingRules, link.ABDestinations, link.UTM); err == nil {
		t.Fatal("a configured one-variant A/B test must still be rejected")
	}
}

func TestZeroMaxClicksNormalizesToUnlimited(t *testing.T) {
	var link Link
	if err := json.Unmarshal([]byte(`{"Destination":"https://example.com","max_clicks":0}`), &link); err != nil {
		t.Fatal(err)
	}
	if link.MaxClicks != nil {
		t.Fatalf("zero max-click value must mean unlimited, got %v", *link.MaxClicks)
	}
}
