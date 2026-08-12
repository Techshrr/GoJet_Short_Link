package billing

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRenderInvoicePDFRequiresBundledUnicodeFont(t *testing.T) {
	_, err := RenderInvoicePDF(InvoicePDFData{
		SiteName: "GoJet", CompanyName: "GoJet", WorkspaceName: "测试工作区",
		InvoiceNumber: "GJ-2026-0001", Amount: "CNY 199.00", FontPath: filepath.Join(t.TempDir(), "missing.ttf"),
	})
	if err == nil || !strings.Contains(err.Error(), "PDF Unicode font unavailable") {
		t.Fatalf("missing font must fail closed, got %v", err)
	}
}

func TestRenderInvoicePDFEmbedsUnicodeFontForChineseAndLatin(t *testing.T) {
	font := filepath.Join("..", "..", "resources", "fonts", "NotoSansSCVF.ttf")
	if _, err := os.Stat(font); err != nil {
		t.Skip("run scripts/preparepdffonts.sh before the PDF render test")
	}
	pdf, err := RenderInvoicePDF(InvoicePDFData{
		BrandColor: "#16A66A", SiteName: "GoJet", CompanyName: "GoJet Technology",
		CompanyAddress: "中国 · 杭州 / Hangzhou, China", ContactEmail: "billing@example.com",
		WorkspaceName: "测试工作区 Test Workspace", InvoiceNumber: "GJ-2026-0001", Status: "paid",
		PlanName: "专业版 Pro", InvoiceType: "purchase", SourceAmount: "USD 27.65", Amount: "CNY 199.00",
		FXRate: "1 USD = 7.197106 CNY", FXProvider: "欧洲中央银行参考汇率", FXMarkup: "0",
		FXQuotedAt: "2026-08-12 01:00", Period: "30 天", CreatedAt: "2026-08-12 01:00",
		DueAt: "2026-08-15 01:00", PaidAt: "2026-08-12 01:10", PaymentMethod: "支付宝 Alipay",
		PaymentReference: "PAY-20260812-ABC123", FontPath: font,
	})
	if err != nil { t.Fatal(err) }
	if len(pdf) < 10_000 { t.Fatalf("embedded-font invoice unexpectedly small: %d", len(pdf)) }
	if string(pdf[:5]) != "%PDF-" { t.Fatalf("invalid PDF header: %q", pdf[:5]) }
	text := string(pdf)
	for _, retired := range []string{"/STSong-Light", "/UniGB-UCS2-H", "/Helvetica-Bold"} {
		if strings.Contains(text, retired) { t.Fatalf("retired viewer fallback font leaked into PDF: %s", retired) }
	}
}

func TestParseHexRGB(t *testing.T) {
	if got := parseHexRGB("#16A66A"); got != (rgb{22,166,106}) { t.Fatalf("unexpected brand rgb: %#v", got) }
	if got := parseHexRGB("bad"); got != (rgb{22,166,106}) { t.Fatalf("invalid brand color did not use default: %#v", got) }
}
