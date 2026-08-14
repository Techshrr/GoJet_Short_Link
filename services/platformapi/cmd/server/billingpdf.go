package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/billing"
)

type preparedInvoiceDownload struct {
	PDF       []byte
	Filename  string
	ExpiresAt time.Time
}

var invoiceDownloadStore = struct {
	sync.Mutex
	items map[string]preparedInvoiceDownload
}{items: map[string]preparedInvoiceDownload{}}

func (s *server) invoicePDF(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	invoiceID, e2 := pathID(r, "invoice")
	if e1 != nil || e2 != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "账单编号无效"})
		return
	}
	pdf, filename, status, message := s.renderInvoicePDFDocument(r, wid, invoiceID)
	if status != 0 {
		jsonResponse(w, status, map[string]string{"error": message, "code": "invoice_pdf_unavailable"})
		return
	}
	writeInvoicePDF(w, pdf, filename)
}

// prepareInvoicePDFDownload renders the PDF before returning a download URL.
// The browser therefore never has to hold a long-running binary fetch open while
// fonts and branding assets are being processed. The returned URL is random,
// short-lived and consumed once.
func (s *server) prepareInvoicePDFDownload(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	invoiceID, e2 := pathID(r, "invoice")
	if e1 != nil || e2 != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "账单编号无效"})
		return
	}
	pdf, filename, status, message := s.renderInvoicePDFDocument(r, wid, invoiceID)
	if status != 0 {
		jsonResponse(w, status, map[string]string{"error": message, "code": "invoice_pdf_unavailable"})
		return
	}

	random := make([]byte, 24)
	if _, err := rand.Read(random); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "暂时无法准备账单下载，请稍后重试", "code": "invoice_download_ticket_unavailable"})
		return
	}
	token := hex.EncodeToString(random)
	now := time.Now()
	invoiceDownloadStore.Lock()
	for key, item := range invoiceDownloadStore.items {
		if !item.ExpiresAt.After(now) {
			delete(invoiceDownloadStore.items, key)
		}
	}
	invoiceDownloadStore.items[token] = preparedInvoiceDownload{PDF: pdf, Filename: filename, ExpiresAt: now.Add(2 * time.Minute)}
	invoiceDownloadStore.Unlock()

	jsonResponse(w, http.StatusOK, map[string]string{
		"url":      "/api/public/invoice-download/" + token,
		"filename": filename,
	})
}

func (s *server) preparedInvoicePDFDownload(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(r.PathValue("ticket"))
	if len(token) != 48 {
		http.NotFound(w, r)
		return
	}
	if _, err := hex.DecodeString(token); err != nil {
		http.NotFound(w, r)
		return
	}

	invoiceDownloadStore.Lock()
	item, ok := invoiceDownloadStore.items[token]
	if ok {
		delete(invoiceDownloadStore.items, token)
	}
	invoiceDownloadStore.Unlock()
	if !ok || !item.ExpiresAt.After(time.Now()) || len(item.PDF) < 1000 {
		http.NotFound(w, r)
		return
	}
	writeInvoicePDF(w, item.PDF, item.Filename)
}

func writeInvoicePDF(w http.ResponseWriter, pdf []byte, filename string) {
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(pdf)))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = w.Write(pdf)
}

func (s *server) renderInvoicePDFDocument(r *http.Request, wid, invoiceID int64) ([]byte, string, int, string) {
	ctx := r.Context()
	if _, err := s.workspace.Role(ctx, wid, currentUser(r).ID); err != nil {
		return nil, "", http.StatusForbidden, "无权下载该账单"
	}
	var number, workspaceName, planName, invoiceType, sourceCurrency, currency, status, paidVia, reference, fxRate, fxProvider string
	var sourceAmount, amount int64
	var fxMarkup, periodDays int
	var createdAt, dueAt time.Time
	var paidAt, fxQuoted sql.NullTime
	err := s.db.QueryRowContext(ctx, `SELECT i.invoice_number,w.name,p.name,i.invoice_type,i.source_amount_cents,i.source_currency,i.amount_cents,i.currency,CAST(i.fx_rate AS CHAR),i.fx_provider,i.fx_markup_bps,i.fx_quoted_at,i.period_days,i.status,COALESCE(i.paid_via,''),COALESCE(i.payment_reference,''),i.created_at,i.due_at,i.paid_at FROM billing_invoices i JOIN workspaces w ON w.id=i.workspace_id JOIN plans p ON p.id=i.plan_id WHERE i.id=? AND i.workspace_id=?`, invoiceID, wid).Scan(&number, &workspaceName, &planName, &invoiceType, &sourceAmount, &sourceCurrency, &amount, &currency, &fxRate, &fxProvider, &fxMarkup, &fxQuoted, &periodDays, &status, &paidVia, &reference, &createdAt, &dueAt, &paidAt)
	if err != nil {
		return nil, "", http.StatusNotFound, "账单不存在"
	}

	paidText := "—"
	if paidAt.Valid {
		paidText = paidAt.Time.Format("2006-01-02 15:04")
	}
	quotedText := ""
	if fxQuoted.Valid {
		quotedText = fxQuoted.Time.Format("2006-01-02 15:04")
	}
	methodNames := map[string]string{"alipay": "支付宝", "wechat": "微信支付", "epay": "易支付", "paypal": "PayPal", "stripe": "Stripe", "manual": "人工确认"}
	method := methodNames[paidVia]
	if method == "" {
		method = paidVia
	}
	if paidVia != "" && paidVia != "manual" {
		method = s.stringSetting(ctx, "payments."+paidVia+".display_name", method)
	}
	providerNames := map[string]string{"ecb": "欧洲中央银行参考汇率", "manual": "手动汇率", "identity": "无需换算"}
	fxName := providerNames[strings.ToLower(fxProvider)]
	if fxName == "" {
		fxName = fxProvider
	}
	formatMoney := func(c string, v int64) string {
		return fmt.Sprintf("%s %d.%02d", strings.ToUpper(c), v/100, v%100)
	}
	data := billing.InvoicePDFData{
		BrandColor:       s.stringSetting(ctx, "brand.primary_color", "#16A66A"),
		SiteName:         s.stringSetting(ctx, "site.short_name", "GoJet"),
		CompanyName:      s.stringSetting(ctx, "site.company_name", "GoJet"),
		CompanyAddress:   s.stringSetting(ctx, "site.company_address", ""),
		ContactEmail:     s.stringSetting(ctx, "site.contact_email", ""),
		WorkspaceName:    workspaceName,
		InvoiceNumber:    number,
		Status:           status,
		PlanName:         planName,
		InvoiceType:      invoiceType,
		SourceAmount:     formatMoney(sourceCurrency, sourceAmount),
		Amount:           formatMoney(currency, amount),
		FXRate:           "1 " + strings.ToUpper(sourceCurrency) + " = " + fxRate + " " + strings.ToUpper(currency),
		FXProvider:       fxName,
		FXMarkup:         strconv.Itoa(fxMarkup),
		FXQuotedAt:       quotedText,
		Period:           fmt.Sprintf("%d 天", periodDays),
		CreatedAt:        createdAt.Format("2006-01-02 15:04"),
		DueAt:            dueAt.Format("2006-01-02 15:04"),
		PaidAt:           paidText,
		PaymentMethod:    method,
		PaymentReference: reference,
		FontPath:         strings.TrimSpace(os.Getenv("PDF_FONT_PATH")),
		LogoPath:         s.invoiceBrandLogoPath(ctx),
	}

	pdf, renderErr := safeInvoicePDFRender(data)
	// A malformed or unsupported uploaded logo must never make the invoice
	// unavailable. Retry once with the textual site identity.
	if renderErr != nil && data.LogoPath != "" {
		data.LogoPath = ""
		pdf, renderErr = safeInvoicePDFRender(data)
	}
	if renderErr != nil {
		return nil, "", http.StatusServiceUnavailable, "账单 PDF 暂时无法生成，请稍后重试或联系管理员"
	}
	return pdf, "GoJetInvoice" + safeInvoiceFilename(number) + ".pdf", 0, ""
}

func safeInvoicePDFRender(data billing.InvoicePDFData) (pdf []byte, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			pdf = nil
			err = fmt.Errorf("invoice PDF renderer panic: %v", recovered)
		}
	}()
	return billing.RenderInvoicePDF(data)
}

func (s *server) invoiceBrandLogoPath(ctx context.Context) string {
	logoURL := strings.TrimSpace(s.stringSetting(ctx, "brand.logo_url", ""))
	if !strings.HasPrefix(logoURL, "/assets/images/") {
		return ""
	}
	name := strings.TrimPrefix(logoURL, "/assets/images/")
	if name == "" || filepath.Base(name) != name {
		return ""
	}
	ext := strings.ToLower(filepath.Ext(name))
	if ext != ".png" && ext != ".jpg" && ext != ".jpeg" {
		return ""
	}
	root := strings.TrimSpace(os.Getenv("BRAND_ASSET_PATH"))
	if root == "" {
		root = "/data/brand"
	}
	path := filepath.Join(root, name)
	if info, err := os.Stat(path); err != nil || info.IsDir() {
		return ""
	}
	return path
}

func (s *server) stringSetting(ctx context.Context, key, fallback string) string {
	raw, exists, err := s.settings.Get(ctx, key)
	if err != nil || !exists || strings.TrimSpace(raw) == "" {
		return fallback
	}
	var value string
	if json.Unmarshal([]byte(raw), &value) == nil {
		return value
	}
	return raw
}

func safeInvoiceFilename(value string) string {
	var out strings.Builder
	for _, ch := range value {
		if ch >= 'A' && ch <= 'Z' || ch >= 'a' && ch <= 'z' || ch >= '0' && ch <= '9' {
			out.WriteRune(ch)
		}
	}
	if out.Len() == 0 {
		return "Document"
	}
	return out.String()
}
