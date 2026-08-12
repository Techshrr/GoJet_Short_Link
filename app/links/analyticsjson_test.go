package links

import (
	"encoding/json"
	"testing"
)

func TestAnalyticsJSONContractUsesProductKeys(t *testing.T) {
	encoded, err := json.Marshal(Analytics{
		Clicks:           12,
		UniqueVisitors:   7,
		BotVisits:        2,
		Sources:          []Dimension{{Name: "direct", Count: 12}},
		OperatingSystems: []Dimension{{Name: "linux", Count: 4}},
		Recent:           []map[string]any{{"source": "direct"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	if err = json.Unmarshal(encoded, &payload); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"clicks", "unique_visitors", "bot_visits", "sources", "countries", "regions", "cities", "devices", "browsers", "operating_systems", "languages", "utm_sources", "destinations", "recent"} {
		if _, ok := payload[key]; !ok {
			t.Fatalf("missing product analytics key %q in %s", key, encoded)
		}
	}
	for _, legacy := range []string{"Clicks", "UniqueVisitors", "BotVisits", "Sources", "OperatingSystems", "Recent"} {
		if _, ok := payload[legacy]; ok {
			t.Fatalf("legacy Go field name %q leaked into product JSON: %s", legacy, encoded)
		}
	}
	if got := int(payload["clicks"].(float64)); got != 12 {
		t.Fatalf("clicks = %d, want 12", got)
	}
}
