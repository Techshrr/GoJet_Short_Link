package main

import (
	"strings"
	"testing"
)

func TestRenderSharedTextFormats(t *testing.T) {
	plain := string(renderSharedText("plain", "hello <script>alert(1)</script>"))
	if !strings.Contains(plain, "&lt;script&gt;") || strings.Contains(plain, "<script>") {
		t.Fatal("plain text must escape HTML")
	}
	code := string(renderSharedText("code", "if (a < b) { return; }"))
	if !strings.Contains(code, `<pre class="code"><code>`) || !strings.Contains(code, "&lt;") {
		t.Fatal("code mode must use an escaped code block")
	}
	markdown := string(renderSharedText("markdown", "# Title\n\n**bold** and [safe](https://example.com)\n\n```\n<script>\n```"))
	for _, expected := range []string{"<h1>Title</h1>", "<strong>bold</strong>", `href="https://example.com"`, "&lt;script&gt;"} {
		if !strings.Contains(markdown, expected) {
			t.Fatalf("markdown output missing %q: %s", expected, markdown)
		}
	}
	if strings.Contains(markdown, "<script>") {
		t.Fatal("markdown renderer emitted raw script HTML")
	}
}
