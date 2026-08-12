package mail

import (
	"os"
	"strings"
	"testing"
)

func TestInlineMailFragmentUsesPortableInlineStyles(t *testing.T) {
	got := inlineMailFragment(`<h1>欢迎</h1><p>正文</p><a class="button" href="https://example.com">打开</a><p class="muted">说明</p>`, "#16A66A")
	for _, want := range []string{"style=\"", "background:#16A66A", "color:#7b8490", "font-size:24px", "border-radius:6px"} {
		if !strings.Contains(got, want) {
			t.Fatalf("missing portable inline mail style %q in %s", want, got)
		}
	}
	if strings.Contains(got, `class="button"`) || strings.Contains(got, `class="muted"`) {
		t.Fatalf("mail fragment still depends on CSS classes: %s", got)
	}
	if strings.Contains(got, "border-radius:14px") {
		t.Fatalf("mail fragment regressed to oversized SaaS-card rounding: %s", got)
	}
}

func TestTransactionalMailShellKeepsBrandCardAndFooterSeparate(t *testing.T) {
	source, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatal(err)
	}
	s := string(source)
	brand := strings.Index(s, "padding:0 8px 18px")
	card := strings.Index(s, "border-radius:12px")
	footer := strings.Index(s, "padding:18px 8px 0")
	if brand < 0 || card < 0 || footer < 0 || !(brand < card && card < footer) {
		t.Fatalf("transactional mail shell must render brand header, body card and external footer in that order")
	}
	for _, required := range []string{"max-width:680px", "border:1px solid #dfe4e8", "此邮件由 ` + html.EscapeString(site) + ` 自动发送"} {
		if !strings.Contains(s, required) {
			t.Fatalf("transactional mail shell missing %q", required)
		}
	}
	if strings.Contains(s, "border-bottom:3px solid") {
		t.Fatal("legacy in-card brand stripe returned to transactional mail shell")
	}
}
