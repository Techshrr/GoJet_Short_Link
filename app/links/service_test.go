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
