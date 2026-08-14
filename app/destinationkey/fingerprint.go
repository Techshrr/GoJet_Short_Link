package destinationkey

import (
	"crypto/sha256"
	"encoding/hex"
	"sort"
	"strings"
)

// Fingerprint returns a deterministic, order-independent identifier for the
// complete set of reachable destinations behind one short link.
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
