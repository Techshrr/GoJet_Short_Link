package links

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestRandomCodeUsesURLSafeAlphabet(t *testing.T) {
	for i := 0; i < 100; i++ {
		code := randomCode(7)
		if len(code) != 7 || strings.ContainsAny(code, "0O1Il /?#") {
			t.Fatalf("unsafe code %q", code)
		}
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
