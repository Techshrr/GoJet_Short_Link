package mail

import (
	"strings"
	"testing"
)

func TestInlineMailFragmentUsesPortableInlineStyles(t *testing.T) {
	got := inlineMailFragment(`<h1>欢迎</h1><p>正文</p><a class="button" href="https://example.com">打开</a><p class="muted">说明</p>`, "#16A66A")
	for _, want := range []string{"style=\"", "background:#16A66A", "color:#7c8983", "font-size:24px"} {
		if !strings.Contains(got, want) {
			t.Fatalf("missing portable inline mail style %q in %s", want, got)
		}
	}
	if strings.Contains(got, `class="button"`) || strings.Contains(got, `class="muted"`) {
		t.Fatalf("mail fragment still depends on CSS classes: %s", got)
	}
}
