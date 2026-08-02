package main

import (
	"bytes"
	"strings"
	"testing"
)

func TestTextPageTemplateEscapesSharedContent(t *testing.T) {
	var output bytes.Buffer
	data := map[string]any{"Title": `Release <script>alert(1)</script>`, "Format": "plain", "Views": 2, "Protected": false, "Content": `<img src=x onerror=alert(1)>`}
	if err := textPageTemplate.Execute(&output, data); err != nil {
		t.Fatal(err)
	}
	html := output.String()
	if strings.Contains(html, "<script>alert") || strings.Contains(html, "<img src=x") || !strings.Contains(html, "&lt;img") {
		t.Fatalf("unsafe output %s", html)
	}
}

func TestBioTemplateRejectsJavascriptURLContext(t *testing.T) {
	var output bytes.Buffer
	data := map[string]any{"Title": "Creator", "Bio": "Bio", "Initial": "C", "Primary": "#1769e0", "Background": "#ffffff", "Links": []map[string]string{{"Label": "unsafe", "URL": "javascript:alert(1)"}}}
	if err := bioPageTemplate.Execute(&output, data); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(output.String(), `href="javascript:`) {
		t.Fatal("javascript URL rendered")
	}
}
