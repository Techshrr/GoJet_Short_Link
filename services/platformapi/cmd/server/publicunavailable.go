package main

import (
	"net/http"
	"net/url"
	"strings"
)

// redirectPublicUnavailable keeps public resource failures on the same branded
// surface as destination-risk blocks. It intentionally sends only the resource
// type and opaque public slug; internal scan details and storage errors remain
// private to the platform.
func redirectPublicUnavailable(w http.ResponseWriter, r *http.Request, kind, reference string) {
	kind = strings.TrimSpace(kind)
	switch kind {
	case "text", "file", "bio":
	default:
		kind = "link"
	}
	values := url.Values{}
	values.Set("reason", "unavailable")
	values.Set("kind", kind)
	if reference = strings.TrimSpace(reference); reference != "" {
		if len(reference) > 80 {
			reference = reference[:80]
		}
		values.Set("ref", reference)
	}
	w.Header().Set("Cache-Control", "no-store")
	http.Redirect(w, r, "/linkunavailable?"+values.Encode(), http.StatusFound)
}
