package destinationrisk

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sort"
	"strings"
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

// Fingerprint is intentionally order-independent. Changing any reachable target
// produces a new risk cache key, so an ALLOW decision for an old destination can
// never authorize a newly-edited primary, routing, or A/B target.
func Fingerprint(targets []string) string {
	unique := map[string]bool{}
	canonical := []string{}
	for _, target := range targets {
		target = strings.TrimSpace(target)
		if target == "" || unique[target] {
			continue
		}
		unique[target] = true
		canonical = append(canonical, target)
	}
	sort.Strings(canonical)
	hash := sha256.Sum256([]byte(strings.Join(canonical, "\n")))
	return hex.EncodeToString(hash[:16])
}

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
