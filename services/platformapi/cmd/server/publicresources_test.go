package main

import (
	"bytes"
	"html/template"
	"strings"
	"testing"
)

func TestTextPageTemplateEscapesTitleAndRenderedContentIsSanitized(t *testing.T) {
	var output bytes.Buffer
	rendered := renderSharedText("plain", `<img src=x onerror=alert(1)>`)
	data := map[string]any{
		"Title":     `Release <script>alert(1)</script>`,
		"Format":    "plain",
		"Views":     2,
		"Protected": false,
		"Rendered":  template.HTML(rendered),
	}
	if err := textPageTemplate.Execute(&output, data); err != nil {
		t.Fatal(err)
	}
	html := output.String()
	if strings.Contains(html, "<script>alert") || strings.Contains(html, "<img src=x") {
		t.Fatalf("unsafe raw HTML escaped its boundary: %s", html)
	}
	if !strings.Contains(html, "&lt;script&gt;alert(1)&lt;/script&gt;") || !strings.Contains(html, "&lt;img src=x onerror=alert(1)&gt;") {
		t.Fatalf("expected escaped title/body are missing: %s", html)
	}
}

func TestMarkdownTextPageAllowsControlledMarkupButNotRawScript(t *testing.T) {
	var output bytes.Buffer
	rendered := renderSharedText("markdown", "# Heading\n\n**bold**\n\n<script>alert(1)</script>")
	data := map[string]any{
		"Title":     "Markdown",
		"Format":    "markdown",
		"Views":     1,
		"Protected": false,
		"Rendered":  rendered,
	}
	if err := textPageTemplate.Execute(&output, data); err != nil {
		t.Fatal(err)
	}
	html := output.String()
	if !strings.Contains(html, "<h1>Heading</h1>") || !strings.Contains(html, "<strong>bold</strong>") {
		t.Fatalf("controlled Markdown markup was not rendered: %s", html)
	}
	if strings.Contains(html, "<script>alert") || !strings.Contains(html, "&lt;script&gt;alert(1)&lt;/script&gt;") {
		t.Fatalf("Markdown raw HTML was not escaped: %s", html)
	}
}

func TestBioTemplateRejectsJavascriptURLContextAndIsNoIndex(t *testing.T) {
	var output bytes.Buffer
	data := map[string]any{"Title": "Creator", "Bio": "Bio", "Initial": "C", "SiteName": "GoJet", "Primary": "#1769e0", "Background": "#ffffff", "Ink": "#14231d", "Muted": "#66766f", "Surface": "#ffffff", "Links": []map[string]string{{"Label": "unsafe", "URL": "javascript:alert(1)"}}}
	if err := bioPageTemplate.Execute(&output, data); err != nil {
		t.Fatal(err)
	}
	html := output.String()
	if strings.Contains(html, `href="javascript:`) {
		t.Fatal("javascript URL rendered")
	}
	if !strings.Contains(html, `<meta name="robots" content="noindex,nofollow">`) {
		t.Fatalf("public Bio page must remain noindex,nofollow: %s", html)
	}
}