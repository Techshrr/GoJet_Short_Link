package main

import (
	"encoding/json"
	"image/color"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Techshrr/GoJet_Short_Link/app/links"
)

func TestP05DateBounds(t *testing.T) {
	r := httptest.NewRequest("GET", "/api/workspaces/1/links/presentation?from=2026-08-01&to=2026-08-18", nil)
	from, to, err := p05DateBounds(r)
	if err != nil {
		t.Fatalf("p05DateBounds returned error: %v", err)
	}
	if from == nil || got := from.Format("2006-01-02"); got != "2026-08-01" {
		t.Fatalf("unexpected from date: %v", from)
	}
	if to == nil || got := to.Format("2006-01-02"); got != "2026-08-19" {
		t.Fatalf("expected exclusive next-day upper bound, got %v", to)
	}
}

func TestP05DateBoundsRejectsInvalidRange(t *testing.T) {
	for _, target := range []string{
		"/api/workspaces/1/links/presentation?from=not-a-date",
		"/api/workspaces/1/links/presentation?from=2026-08-20&to=2026-08-18",
	} {
		r := httptest.NewRequest("GET", target, nil)
		if _, _, err := p05DateBounds(r); err == nil {
			t.Fatalf("expected invalid date range to fail: %s", target)
		}
	}
}

func TestP05LinkPresentationMarshalJSON(t *testing.T) {
	payload, err := json.Marshal(p05LinkPresentation{
		Link: links.Link{
			ID:             11,
			WorkspaceID:    1,
			Code:           "summer",
			Domain:         "go.gt",
			Destination:    "https://example.com/summer",
			Status:         "active",
			RedirectStatus: 302,
			PasswordHash:   "must-never-leak",
		},
		UpdatedAt:         "2026-08-18 02:00:00",
		PasswordProtected: true,
	})
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}
	text := string(payload)
	for _, expected := range []string{`"updated_at":"2026-08-18 02:00:00"`, `"password_protected":true`, `"code":"summer"`} {
		if !strings.Contains(text, expected) {
			t.Fatalf("presentation JSON missing %s: %s", expected, text)
		}
	}
	if strings.Contains(text, "must-never-leak") || strings.Contains(text, "PasswordHash") {
		t.Fatalf("password hash leaked in presentation JSON: %s", text)
	}
}

func TestP05QRSVG(t *testing.T) {
	bitmap := [][]bool{{true, false}, {false, true}}
	payload := string(p05QRSVG(bitmap, 512, "#111111", "#eeeeee"))
	if !strings.HasPrefix(payload, `<svg`) || !strings.Contains(payload, `viewBox="0 0 2 2"`) {
		t.Fatalf("invalid SVG payload: %s", payload)
	}
	if count := strings.Count(payload, `<rect`); count != 3 {
		t.Fatalf("expected background plus two dark modules, got %d rects", count)
	}
}

func TestP05QRPDF(t *testing.T) {
	bitmap := [][]bool{{true, false}, {false, true}}
	payload := p05QRPDF(bitmap, 512, color.Black, color.White)
	text := string(payload)
	if !strings.HasPrefix(text, "%PDF-1.4") {
		t.Fatalf("missing PDF header: %q", text[:min(16, len(text))])
	}
	for _, marker := range []string{"xref", "trailer", "%%EOF"} {
		if !strings.Contains(text, marker) {
			t.Fatalf("PDF missing %s", marker)
		}
	}
}
