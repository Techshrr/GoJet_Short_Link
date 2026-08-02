package resources

import "testing"

func TestCleanSlug(t *testing.T) {
	if got := cleanSlug("Hello <Script> 世界"); got != "helloscript" {
		t.Fatalf("slug=%q", got)
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
