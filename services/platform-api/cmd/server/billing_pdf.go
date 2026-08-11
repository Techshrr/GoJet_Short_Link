package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/billing"
)

func (s *server) invoicePDF(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	invoiceID, e2 := pathID(r, "invoice")
	if e1 != nil || e2 != nil { jsonResponse(w, 400, map[string]string{"error": "账单编号无效"}); return }
	if _, err := s.workspace.Role(r.Context(), wid, currentUser(r).ID); err != nil { jsonResponse(w, 403, map[string]string{"error": "无权下载该账单"}); return }
	var number, workspaceName, planName, invoiceType, sourceCurrency, currency, status, paidVia, reference, fxRate, fxProvider string
	var sourceAmount, amount int64
	var fxMarkup, periodDays int
	var createdAt, dueAt time.Time
	var paidAt, fxQuoted sql.NullTime
	err := s.db.QueryRowContext(r.Context(), `SELECT i.invoice_number,w.name,p.name,i.invoice_type,i.source_amount_cents,i.source_currency,i.amount_cents,i.currency,CAST(i.fx_rate AS CHAR),i.fx_provider,i.fx_markup_bps,i.fx_quoted_at,i.period_days,i.status,COALESCE(i.paid_via,''),COALESCE(i.payment_reference,''),i.created_at,i.due_at,i.paid_at FROM billing_invoices i JOIN workspaces w ON w.id=i.workspace_id JOIN plans p ON p.id=i.plan_id WHERE i.id=? AND i.workspace_id=?`, invoiceID, wid).Scan(&number,&workspaceName,&planName,&invoiceType,&sourceAmount,&sourceCurrency,&amount,&currency,&fxRate,&fxProvider,&fxMarkup,&fxQuoted,&periodDays,&status,&paidVia,&reference,&createdAt,&dueAt,&paidAt)
	if err != nil { jsonResponse(w, 404, map[string]string{"error": "账单不存在"}); return }
	paidText := "—"; if paidAt.Valid { paidText = paidAt.Time.Format("2006-01-02 15:04") }
	quotedText := ""; if fxQuoted.Valid { quotedText = fxQuoted.Time.Format("2006-01-02 15:04") }
	methodNames := map[string]string{"alipay":"支付宝","wechat":"微信支付","epay":"易支付兼容协议","paypal":"PayPal","stripe":"Stripe","manual":"人工确认"}
	method := methodNames[paidVia]; if method == "" { method = paidVia }
	providerNames:=map[string]string{"ecb":"欧洲中央银行参考汇率","manual":"手动汇率","identity":"无需换算"}
	fxName:=providerNames[strings.ToLower(fxProvider)];if fxName==""{fxName=fxProvider}
	formatMoney:=func(c string,v int64)string{return fmt.Sprintf("%s %d.%02d",strings.ToUpper(c),v/100,v%100)}
	data := billing.InvoicePDFData{
		BrandColor: s.stringSetting(r.Context(), "brand.primary_color", "#16A66A"),
		SiteName: s.stringSetting(r.Context(), "site.short_name", "GoJet"),
		CompanyName: s.stringSetting(r.Context(), "site.company_name", "GoJet"),
		CompanyAddress: s.stringSetting(r.Context(), "site.company_address", ""),
		ContactEmail: s.stringSetting(r.Context(), "site.contact_email", ""),
		WorkspaceName: workspaceName, InvoiceNumber: number, Status: status, PlanName: planName, InvoiceType: invoiceType,
		SourceAmount: formatMoney(sourceCurrency,sourceAmount), Amount: formatMoney(currency,amount), FXRate: "1 "+strings.ToUpper(sourceCurrency)+" = "+fxRate+" "+strings.ToUpper(currency), FXProvider: fxName, FXMarkup: strconv.Itoa(fxMarkup), FXQuotedAt: quotedText,
		Period: fmt.Sprintf("%d 天",periodDays), CreatedAt: createdAt.Format("2006-01-02 15:04"), DueAt: dueAt.Format("2006-01-02 15:04"), PaidAt: paidText, PaymentMethod: method, PaymentReference: reference,
		FontPath: strings.TrimSpace(os.Getenv("PDF_FONT_PATH")), LogoPath: s.invoiceBrandLogoPath(r.Context()),
	}
	pdf, renderErr := billing.RenderInvoicePDF(data)
	if renderErr != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "账单 PDF 资源不可用，请联系管理员", "code": "invoice_pdf_unavailable"})
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `attachment; filename="GoJet-Invoice-`+safeInvoiceFilename(number)+`.pdf"`)
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(pdf)))
	_, _ = w.Write(pdf)
}

func (s *server) invoiceBrandLogoPath(ctx context.Context) string {
	logoURL := strings.TrimSpace(s.stringSetting(ctx, "brand.logo_url", ""))
	if !strings.HasPrefix(logoURL, "/assets/images/") { return "" }
	name := strings.TrimPrefix(logoURL, "/assets/images/")
	if name == "" || filepath.Base(name) != name { return "" }
	ext := strings.ToLower(filepath.Ext(name))
	if ext != ".png" && ext != ".jpg" && ext != ".jpeg" { return "" }
	root := strings.TrimSpace(os.Getenv("BRAND_ASSET_PATH")); if root == "" { root = "/data/brand" }
	path := filepath.Join(root, name)
	if info, err := os.Stat(path); err != nil || info.IsDir() { return "" }
	return path
}

func (s *server) stringSetting(ctx context.Context, key, fallback string) string {
	raw, exists, err := s.settings.Get(ctx, key)
	if err != nil || !exists || strings.TrimSpace(raw) == "" { return fallback }
	var value string
	if json.Unmarshal([]byte(raw), &value) == nil { return value }
	return raw
}

func safeInvoiceFilename(value string) string {
	var out strings.Builder
	for _, ch := range value { if ch >= 'A' && ch <= 'Z' || ch >= 'a' && ch <= 'z' || ch >= '0' && ch <= '9' || ch == '-' || ch == '_' { out.WriteRune(ch) } }
	if out.Len() == 0 { return "invoice" }
	return out.String()
}
