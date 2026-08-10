package billing

import (
	"bytes"
	"testing"
)

func TestRenderInvoicePDF(t *testing.T) {
	pdf := RenderInvoicePDF(InvoicePDFData{
		BrandColor: "#16A66A", SiteName: "GoJet", CompanyName: "GoJet",
		WorkspaceName: "测试工作区", InvoiceNumber: "GJ-20260810-001", Status: "paid",
		PlanName: "专业版", InvoiceType: "purchase", Amount: "CNY 69.00",
		CreatedAt: "2026-08-10 17:00", DueAt: "2026-08-13 17:00", PaidAt: "2026-08-10 17:05",
		PaymentMethod: "支付宝", PaymentReference: "20260810220000000001",
	})
	if len(pdf) < 1000 { t.Fatalf("PDF unexpectedly small: %d", len(pdf)) }
	if !bytes.HasPrefix(pdf, []byte("%PDF-1.4")) { t.Fatal("missing PDF header") }
	for _, marker := range [][]byte{[]byte("/Type /Catalog"), []byte("/UniGB-UCS2-H"), []byte("xref"), []byte("%%EOF")} {
		if !bytes.Contains(pdf, marker) { t.Fatalf("missing PDF marker %q", marker) }
	}
}
