package links

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestLinkJSONUsesSnakeCaseAndAcceptsLegacyRedirectStatus(t *testing.T) {
	encoded, err := json.Marshal(Link{ID: 7, Code: "demo", Destination: "https://example.com", RedirectStatus: 307, OneTime: true})
	if err != nil { t.Fatal(err) }
	text := string(encoded)
	for _, expected := range []string{`"id":7`, `"code":"demo"`, `"destination":"https://example.com"`, `"redirect_status":307`, `"one_time":true`} {
		if !strings.Contains(text, expected) { t.Fatalf("missing %s in %s", expected, text) }
	}
	if strings.Contains(text, "RedirectStatus") { t.Fatalf("legacy Go field leaked into JSON: %s", text) }

	var current Link
	if err = json.Unmarshal([]byte(`{"destination":"https://example.com/next","redirect_status":308}`), &current); err != nil { t.Fatal(err) }
	if current.RedirectStatus != 308 || current.Destination != "https://example.com/next" { t.Fatalf("snake_case decode failed: %#v", current) }

	var legacy Link
	if err = json.Unmarshal([]byte(`{"Destination":"https://example.com/legacy","RedirectStatus":301}`), &legacy); err != nil { t.Fatal(err) }
	if legacy.RedirectStatus != 301 || legacy.Destination != "https://example.com/legacy" { t.Fatalf("legacy decode failed: %#v", legacy) }
}
