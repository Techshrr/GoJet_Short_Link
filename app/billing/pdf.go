package billing

import (
	"bytes"
	"fmt"
	"strconv"
	"strings"
	"unicode/utf16"
)

type InvoicePDFData struct {
	BrandColor       string
	SiteName         string
	CompanyName      string
	CompanyAddress   string
	ContactEmail     string
	WorkspaceName    string
	InvoiceNumber    string
	Status           string
	PlanName         string
	InvoiceType      string
	SourceAmount     string
	Amount           string
	FXRate           string
	FXProvider       string
	FXMarkup         string
	FXQuotedAt       string
	Period           string
	CreatedAt        string
	DueAt            string
	PaidAt           string
	PaymentMethod    string
	PaymentReference string
}

// RenderInvoicePDF intentionally keeps the invoice renderer self-contained so a
// fresh installation can generate a readable PDF without an external browser or
// font package. Every painted background is isolated with q/Q and every text
// helper sets its own fill color; PDF graphics state is never allowed to leak
// from a pale panel into subsequent text.
func RenderInvoicePDF(data InvoicePDFData) []byte {
	brandR, brandG, brandB := parseHexColor(data.BrandColor)
	if strings.TrimSpace(data.SiteName) == "" {
		data.SiteName = "GoJet"
	}
	if strings.TrimSpace(data.CompanyName) == "" {
		data.CompanyName = data.SiteName
	}
	status := map[string]string{"pending": "待支付", "paid": "已支付", "void": "已作废", "overdue": "已逾期"}[data.Status]
	if status == "" {
		status = data.Status
	}
	invoiceType := map[string]string{"purchase": "购买套餐", "upgrade": "变更套餐", "renewal": "续费"}[data.InvoiceType]
	if invoiceType == "" {
		invoiceType = data.InvoiceType
	}

	var content strings.Builder
	fillRect(&content, brandR, brandG, brandB, 0, 832, 595, 10)
	writeSmart(&content, 46, 798, 22, data.SiteName)
	writeChinese(&content, 46, 758, 25, "账单")
	writeChinese(&content, 46, 731, 9.5, "账单编号")
	writeASCII(&content, 105, 731, 9.5, data.InvoiceNumber)
	statusWidth := 54.0
	if len([]rune(status)) > 3 {
		statusWidth = 70
	}
	fillRect(&content, brandR*0.10+0.90, brandG*0.10+0.90, brandB*0.10+0.90, 499-statusWidth, 746, statusWidth, 26)
	writeChinese(&content, 458-statusWidth/2, 754, 10, status)
	strokeLine(&content, brandR, brandG, brandB, 46, 708, 549, 708)

	writeChinese(&content, 46, 680, 9.5, "服务方")
	writeSmart(&content, 46, 657, 12, data.CompanyName)
	serviceY := 638.0
	if strings.TrimSpace(data.CompanyAddress) != "" {
		writeSmart(&content, 46, serviceY, 9, data.CompanyAddress)
		serviceY -= 17
	}
	if strings.TrimSpace(data.ContactEmail) != "" {
		writeASCII(&content, 46, serviceY, 9, data.ContactEmail)
	}
	writeChinese(&content, 332, 680, 9.5, "客户")
	writeSmart(&content, 332, 657, 12, data.WorkspaceName)

	fillRect(&content, 0.95, 0.97, 0.96, 46, 582, 503, 32)
	writeChinese(&content, 58, 592, 9, "套餐")
	writeChinese(&content, 238, 592, 9, "类型")
	writeChinese(&content, 356, 592, 9, "服务周期")
	writeChinese(&content, 458, 592, 9, "结算金额")
	writeSmart(&content, 58, 555, 10.5, data.PlanName)
	writeSmart(&content, 238, 555, 10, invoiceType)
	writeSmart(&content, 356, 555, 10, data.Period)
	writeASCII(&content, 449, 555, 10.5, data.Amount)
	strokeLine(&content, 0.86, 0.90, 0.88, 46, 536, 549, 536)

	y := 502.0
	if data.SourceAmount != "" && data.SourceAmount != data.Amount {
		writeLabelValue(&content, 46, y, "套餐计价", data.SourceAmount, true)
		y -= 21
		writeLabelValue(&content, 46, y, "锁定汇率", data.FXRate, true)
		if strings.TrimSpace(data.FXProvider) != "" {
			writeChinese(&content, 350, y, 8.5, "来源")
			writeSmart(&content, 386, y, 8.5, data.FXProvider)
		}
		y -= 21
		if data.FXMarkup != "" && data.FXMarkup != "0" {
			writeLabelValue(&content, 46, y, "汇率调整", data.FXMarkup+" 个基点", false)
			y -= 21
		}
		if data.FXQuotedAt != "" {
			writeLabelValue(&content, 46, y, "汇率时间", data.FXQuotedAt, true)
			y -= 25
		}
	}
	writeLabelValue(&content, 46, y, "开具时间", data.CreatedAt, true)
	y -= 22
	writeLabelValue(&content, 46, y, "支付期限", data.DueAt, true)
	y -= 22
	if data.PaidAt != "" && data.PaidAt != "—" {
		writeLabelValue(&content, 46, y, "支付时间", data.PaidAt, true)
		y -= 22
	}
	if data.PaymentMethod != "" {
		writeLabelValue(&content, 46, y, "支付方式", data.PaymentMethod, false)
		y -= 22
	}
	if data.PaymentReference != "" {
		writeLabelValue(&content, 46, y, "支付参考号", data.PaymentReference, true)
		y -= 22
	}

	summaryY := y - 82
	if summaryY < 190 {
		summaryY = 190
	}
	fillRect(&content, brandR*0.055+0.945, brandG*0.055+0.945, brandB*0.055+0.945, 46, summaryY, 503, 72)
	writeChinese(&content, 62, summaryY+46, 9.5, "最终结算金额")
	writeASCII(&content, 62, summaryY+17, 22, data.Amount)

	strokeLine(&content, 0.90, 0.92, 0.91, 46, 106, 549, 106)
	writeChinese(&content, 46, 83, 8.5, "此账单由 GoJet 自动生成。金额与汇率以账单生成时保存的快照为准。")
	writeSmart(&content, 46, 62, 8, data.SiteName)

	stream := content.String()
	objects := []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F0 4 0 R /F1 6 0 R >> >> /Contents 7 0 R >>",
		"<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [5 0 R] >>",
		"<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
		fmt.Sprintf("<< /Length %d >>\nstream\n%sendstream", len(stream), stream),
	}
	return buildPDF(objects)
}

func writeLabelValue(builder *strings.Builder, x, y float64, label, value string, preferASCII bool) {
	writeChinese(builder, x, y, 9, label)
	if preferASCII && isASCII(value) {
		writeASCII(builder, x+82, y, 9, value)
	} else {
		writeSmart(builder, x+82, y, 9, value)
	}
}

func fillRect(builder *strings.Builder, r, g, b, x, y, width, height float64) {
	builder.WriteString(fmt.Sprintf("q %.4f %.4f %.4f rg %.1f %.1f %.1f %.1f re f Q\n", r, g, b, x, y, width, height))
}

func strokeLine(builder *strings.Builder, r, g, b, x1, y1, x2, y2 float64) {
	builder.WriteString(fmt.Sprintf("q %.4f %.4f %.4f RG %.1f %.1f m %.1f %.1f l S Q\n", r, g, b, x1, y1, x2, y2))
}

func writeSmart(builder *strings.Builder, x, y, size float64, text string) {
	if isASCII(text) {
		writeASCII(builder, x, y, size, text)
		return
	}
	writeChinese(builder, x, y, size, text)
}

func isASCII(text string) bool {
	for _, r := range text {
		if r > 127 {
			return false
		}
	}
	return true
}

func writeChinese(builder *strings.Builder, x, y, size float64, text string) {
	if strings.TrimSpace(text) == "" {
		return
	}
	builder.WriteString(fmt.Sprintf("BT 0.055 0.075 0.067 rg /F0 %.1f Tf %.1f %.1f Td <%s> Tj ET\n", size, x, y, utf16Hex(text)))
}

func writeASCII(builder *strings.Builder, x, y, size float64, text string) {
	if strings.TrimSpace(text) == "" {
		return
	}
	text = strings.ReplaceAll(text, "\\", "\\\\")
	text = strings.ReplaceAll(text, "(", "\\(")
	text = strings.ReplaceAll(text, ")", "\\)")
	builder.WriteString(fmt.Sprintf("BT 0.055 0.075 0.067 rg /F1 %.1f Tf %.1f %.1f Td (%s) Tj ET\n", size, x, y, text))
}

func utf16Hex(text string) string {
	units := utf16.Encode([]rune(text))
	var out strings.Builder
	for _, unit := range units {
		out.WriteString(fmt.Sprintf("%04X", unit))
	}
	return out.String()
}

func parseHexColor(value string) (float64, float64, float64) {
	value = strings.TrimPrefix(strings.TrimSpace(value), "#")
	if len(value) != 6 {
		value = "16A66A"
	}
	parts := []string{value[0:2], value[2:4], value[4:6]}
	nums := make([]int64, 3)
	for i, part := range parts {
		number, err := strconv.ParseInt(part, 16, 64)
		if err != nil {
			return 22.0 / 255, 166.0 / 255, 106.0 / 255
		}
		nums[i] = number
	}
	return float64(nums[0]) / 255, float64(nums[1]) / 255, float64(nums[2]) / 255
}

func buildPDF(objects []string) []byte {
	var out bytes.Buffer
	out.WriteString("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")
	offsets := make([]int, len(objects)+1)
	for index, object := range objects {
		offsets[index+1] = out.Len()
		fmt.Fprintf(&out, "%d 0 obj\n%s\nendobj\n", index+1, object)
	}
	xref := out.Len()
	fmt.Fprintf(&out, "xref\n0 %d\n0000000000 65535 f \n", len(objects)+1)
	for i := 1; i <= len(objects); i++ {
		fmt.Fprintf(&out, "%010d 00000 n \n", offsets[i])
	}
	fmt.Fprintf(&out, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(objects)+1, xref)
	return out.Bytes()
}
