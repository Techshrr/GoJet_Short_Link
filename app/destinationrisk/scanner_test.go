package destinationrisk

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"strings"
	"testing"
)

func hasCategory(items []Category, wanted Category) bool {
	for _, item := range items {
		if item == wanted {
			return true
		}
	}
	return false
}

func TestPublicIPBoundary(t *testing.T) {
	blocked := []string{"127.0.0.1", "10.0.0.1", "172.16.1.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.1", "224.0.0.1", "::1", "fc00::1", "fe80::1"}
	for _, value := range blocked {
		if publicIP(net.ParseIP(value)) {
			t.Fatalf("%s must not be considered a public destination", value)
		}
	}
	for _, value := range []string{"1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"} {
		if !publicIP(net.ParseIP(value)) {
			t.Fatalf("%s should be considered public", value)
		}
	}
}

func TestValidateTargetRejectsSSRFTargets(t *testing.T) {
	scanner := New(nil)
	cases := []string{
		"http://127.0.0.1/admin",
		"http://169.254.169.254/latest/meta-data/",
		"http://10.0.0.5/private",
		"http://localhost/internal",
		"http://user:password@8.8.8.8/",
		"http://8.8.8.8:6379/",
		"file:///etc/passwd",
	}
	for _, target := range cases {
		if _, err := scanner.validateTarget(context.Background(), target); err == nil {
			t.Fatalf("SSRF target must be rejected: %s", target)
		}
	}
	if _, err := scanner.validateTarget(context.Background(), "https://1.1.1.1/"); err != nil {
		t.Fatalf("public HTTPS literal should pass network validation: %v", err)
	}
}

func TestAssessPrivateTargetBlocksWithoutFetch(t *testing.T) {
	assessment := New(nil).Assess(context.Background(), []string{"http://127.0.0.1/private"})
	if assessment.Decision != Block || assessment.Score != 100 {
		t.Fatalf("private target must block: %+v", assessment)
	}
	if !hasCategory(assessment.Categories, CategoryPlatformSecurity) {
		t.Fatalf("private target must include platform security category: %+v", assessment.Categories)
	}
}

func TestClassifyReviewCategories(t *testing.T) {
	tests := []struct {
		name     string
		snapshot Snapshot
		category Category
		minimum  int
	}{
		{"adult", Snapshot{FinalURL: "https://example.test/", Body: "premium porn videos"}, CategoryAdult, 45},
		{"gambling", Snapshot{FinalURL: "https://example.test/", Body: "online casino bonus"}, CategoryGambling, 45},
		{"fraud", Snapshot{FinalURL: "https://example.test/", Body: "Security alert: verify your account password for your bank immediately"}, CategoryFraud, 45},
		{"copyright", Snapshot{FinalURL: "https://example.test/", Body: "cracked software downloads"}, CategoryCopyright, 45},
		{"pyramid", Snapshot{FinalURL: "https://example.test/", Body: "pyramid scheme recruit downline"}, CategoryPyramidMarketing, 45},
		{"resale", Snapshot{FinalURL: "https://example.test/", Body: "verified account for sale"}, CategoryAccountResale, 45},
		{"spam", Snapshot{FinalURL: "https://example.test/", Body: "bulk sms sender without consent"}, CategorySpam, 45},
	}
	for _, item := range tests {
		t.Run(item.name, func(t *testing.T) {
			score, categories, _ := classify(item.snapshot)
			if score < item.minimum || !hasCategory(categories, item.category) {
				t.Fatalf("expected category %s with score >= %d; score=%d categories=%v", item.category, item.minimum, score, categories)
			}
			if decisionForScore(score) == Allow {
				t.Fatalf("risk signal should not remain allow: score=%d", score)
			}
		})
	}
}

func TestClassifyExplicitAdultHostBlocksBeforeBodyFetch(t *testing.T) {
	score, categories, signals := classify(Snapshot{FinalURL: "https://missav.ws/dm84/jul-343", Headers: map[string]string{}})
	if score < 90 || decisionForScore(score) != Block {
		t.Fatalf("explicit adult host must block without fetched body: score=%d signals=%v", score, signals)
	}
	if !hasCategory(categories, CategoryAdult) {
		t.Fatalf("adult host must include adult category: %v", categories)
	}
}

func TestPublicFetchErrorNeverLeaksSocketAddresses(t *testing.T) {
	raw := errors.New(`Get "https://missav.ws/dm84/jul-343": read tcp 110.42.32.62:31186->104.20.31.186:443: read: connection reset by peer`)
	message := publicFetchError(raw)
	for _, secret := range []string{"110.42.32.62", "104.20.31.186", "31186", "443"} {
		if strings.Contains(message, secret) {
			t.Fatalf("public transport error leaked socket detail %q in %q", secret, message)
		}
	}
	if message == "" {
		t.Fatal("public transport error must retain a safe diagnostic message")
	}
}

func TestClassifyHighConfidenceHarmfulAutomationBlocks(t *testing.T) {
	snapshot := Snapshot{FinalURL: "https://example.test/", Body: "DDoS layer 7 attack booter stresser attack panel"}
	score, categories, signals := classify(snapshot)
	if score < 90 || decisionForScore(score) != Block {
		t.Fatalf("high-confidence DDoS service should block: score=%d signals=%v", score, signals)
	}
	if !hasCategory(categories, CategoryHarmfulAutomation) || !hasCategory(categories, CategoryPlatformSecurity) {
		t.Fatalf("expected harmful automation and platform security categories: %v", categories)
	}
}

func TestTargetsIncludesPrimaryRoutingAndAB(t *testing.T) {
	routing := json.RawMessage(`[{"Dimension":"country","Value":"US","Destination":"https://route.example/us"},{"dimension":"device","value":"mobile","destination":"https://route.example/mobile"}]`)
	ab := json.RawMessage(`[{"ID":"a","Destination":"https://ab.example/a","Weight":50},{"id":"b","destination":"https://ab.example/b","weight":50}]`)
	targets := Targets("https://primary.example/", routing, ab)
	want := []string{"https://primary.example/", "https://route.example/us", "https://route.example/mobile", "https://ab.example/a", "https://ab.example/b"}
	if len(targets) != len(want) {
		t.Fatalf("unexpected target count: got=%v", targets)
	}
	for index := range want {
		if targets[index] != want[index] {
			t.Fatalf("target %d got %q want %q", index, targets[index], want[index])
		}
	}
}

func TestExtractTitle(t *testing.T) {
	if got := extractTitle("<html><head><TITLE class=\"x\">  Example Risk Page  </TITLE></head></html>"); got != "Example Risk Page" {
		t.Fatalf("unexpected title %q", got)
	}
	if got := extractTitle("<html><title without-close"); got != "" {
		t.Fatalf("malformed title must not produce content: %q", got)
	}
}
