package mail

import (
	"os"
	"strings"
	"testing"
)

func TestInlineMailFragmentUsesPortableInlineStyles(t *testing.T) {
	got := inlineMailFragment(`<h1>欢迎</h1><p>正文</p><a class="button" href="https://example.com">打开</a><p class="muted">说明</p>`, "#16A66A")
	for _, want := range []string{
		`style="`,
		"background:#16A66A",
		"font-size:22px",
		"font-size:14px",
		"color:#7d8882",
		"border-radius:9px",
		"line-height:1.8",
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("missing portable inline mail style %q in %s", want, got)
		}
	}
	if strings.Contains(got, `class="button"`) || strings.Contains(got, `class="muted"`) {
		t.Fatalf("mail fragment still depends on CSS classes: %s", got)
	}
	if strings.Contains(got, `<style`) || strings.Contains(got, `javascript:`) {
		t.Fatalf("mail fragment must stay self-contained and portable: %s", got)
	}
}

func TestTransactionalMailShellKeepsBrandCardAndFooterSeparate(t *testing.T) {
	source, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatal(err)
	}
	s := string(source)

	header := strings.Index(s, "padding:23px 30px;border-top:3px solid")
	body := strings.Index(s, "padding:30px 32px 34px;")
	footer := strings.Index(s, "padding:17px 10px 0;text-align:center")
	if header < 0 || body < 0 || footer < 0 || !(header < body && body < footer) {
		t.Fatalf("transactional mail shell must render brand header, message body and external footer in that order")
	}
	for _, required := range []string{
		"max-width:640px",
		"border:1px solid #dfe5e2",
		"background:#f4f6f5",
		"border-top:3px solid ` + primary + `",
		"此邮件由 ` + html.EscapeString(site) + ` 自动发送",
	} {
		if !strings.Contains(s, required) {
			t.Fatalf("transactional mail shell missing %q", required)
		}
	}
}
