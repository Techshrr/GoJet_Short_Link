package destinationrisk

import (
	"encoding/json"
	"strings"

	"github.com/Techshrr/GoJet_Short_Link/app/destinationkey"
)

// Targets returns every destination that can be reached through a short link.
// The links package currently serializes routing/A-B structs with Go field names,
// while browser payloads may use snake_case/camel-case during compatibility flows;
// decodeMapTargets covers both without widening the accepted link contract itself.
func Targets(primary string, routingRules, abDestinations json.RawMessage) []string {
	seen := map[string]bool{}
	out := []string{}
	add := func(value string) {
		value = strings.TrimSpace(value)
		if value != "" && !seen[value] {
			seen[value] = true
			out = append(out, value)
		}
	}
	add(primary)
	decodeMapTargets(routingRules, add)
	decodeMapTargets(abDestinations, add)
	return out
}

// Fingerprint remains part of the destinationrisk API while redirectengine uses
// the same dependency-free implementation directly from app/destinationkey.
func Fingerprint(targets []string) string { return destinationkey.Fingerprint(targets) }

func decodeMapTargets(raw json.RawMessage, add func(string)) {
	if len(raw) == 0 || string(raw) == "null" {
		return
	}
	var items []map[string]any
	if json.Unmarshal(raw, &items) != nil {
		return
	}
	for _, item := range items {
		for _, key := range []string{"Destination", "destination", "target", "url"} {
			if value, ok := item[key].(string); ok {
				add(value)
				break
			}
		}
	}
}
