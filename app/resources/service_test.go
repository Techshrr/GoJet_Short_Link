package resources

import (
	"encoding/json"
	"testing"
	"time"
)

func TestCleanSlug(t *testing.T) {
	if got := cleanSlug("Hello <Script> 世界"); got != "helloscript" {
		t.Fatalf("slug=%q", got)
	}
}

func TestValidateBioRejectsJavascriptLink(t *testing.T) {
	item := BioPage{Title: "Creator", Theme: json.RawMessage(`{"primary":"#1769e0","background":"#ffffff"}`), Blocks: json.RawMessage(`[{"label":"unsafe","url":"javascript:alert(1)"}]`)}
	if err := validateBio(item); err == nil {
		t.Fatal("javascript link must be rejected")
	}
}
func TestParseHex(t *testing.T) {
	if _, err := parseHex("#1769e0"); err != nil {
		t.Fatal(err)
	}
	if _, err := parseHex("red"); err == nil {
		t.Fatal("invalid color accepted")
	}
}

func TestNormalizeExpiryRejectsPastDate(t *testing.T) {
	past := time.Now().Add(-time.Minute)
	if err := normalizeExpiry(&past); err == nil {
		t.Fatal("past expiry must be rejected")
	}
	future := time.Now().Add(time.Hour)
	if err := normalizeExpiry(&future); err != nil {
		t.Fatalf("future expiry rejected: %v", err)
	}
}
