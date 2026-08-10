package billing

import (
	"bytes"
	"fmt"
	"strconv"
	"strings"
	"unicode/utf16"
)

type InvoicePDFData struct {
	BrandColor        string
	SiteName          string
	CompanyName       string
	CompanyAddress    string
	ContactEmail      string
	WorkspaceName     string
	InvoiceNumber     string
	Status            string
	PlanName          string
	InvoiceType       string
	SourceAmount      string
	Amount            string
	FXRate            string
	FXProvider        string
	FXMarkup          string
	FXQuotedAt        string
	Period            string
	CreatedAt         string
	DueAt             string
	PaidAt            string
	PaymentMethod     string
	PaymentReference  string
}

func RenderInvoicePDF(data InvoicePDFData) []byte {
	brandR, brandG, brandB := parseHexColor(data.BrandColor)
	if strings.TrimSpace(data.SiteName) == "" { data.SiteName = "GoJet" }
	if strings.TrimSpace(data.CompanyName) == "" { data.CompanyName = data.SiteName }
	status := map[string]string{"pending":"待支付","paid":"已支付","void":"已作废","overdue":"已逾期"}[data.Status]
	if status == "" { status = data.Status }
	invoiceType := map[string]string{"purchase":"购买套餐","upgrade":"变更套餐","renewal":"续费"}[data.InvoiceType]
	if invoiceType == "" { invoiceType = data.InvoiceType }

	var content strings.Builder
	content.WriteString("q\n")
	content.WriteString(fmt.Sprintf("%.4f %.4f %.4f rg 0 792 595 50 re f\n", brandR, brandG, brandB))
	content.WriteString("Q\n")
	writeASCII(&content, 46, 810, 24, data.SiteName)
	writeChinese(&content, 46, 756, 26, "账单")
	writeChinese(&content, 46, 730, 10, "账单编号："+data.InvoiceNumber)
	writeChinese(&content, 430, 754, 11, status)
	content.WriteString(fmt.Sprintf("%.4f %.4f %.4f RG 46 705 m 549 705 l S\n", brandR, brandG, brandB))

	writeChinese(&content, 46, 676, 11, "服务方")
	writeChinese(&content, 46, 656, 12, data.CompanyName)
	writeChinese(&content, 46, 638, 9, data.CompanyAddress)
	writeASCII(&content, 46, 621, 9, data.ContactEmail)
	writeChinese(&content, 330, 676, 11, "客户")
	writeChinese(&content, 330, 656, 12, data.WorkspaceName)

	content.WriteString("0.95 0.97 0.96 rg 46 568 503 34 re f\n")
	writeChinese(&content, 58, 579, 10, "套餐")
	writeChinese(&content, 245, 579, 10, "类型")
	writeChinese(&content, 360, 579, 10, "服务周期")
	writeChinese(&content, 465, 579, 10, "结算金额")
	writeChinese(&content, 58, 544, 11, data.PlanName)
	writeChinese(&content, 245, 544, 10, invoiceType)
	writeChinese(&content, 360, 544, 10, data.Period)
	writeASCII(&content, 446, 544, 11, data.Amount)
	content.WriteString("0.86 0.90 0.88 RG 46 525 m 549 525 l S\n")

	y := 492.0
	if data.SourceAmount != "" && data.SourceAmount != data.Amount {
		writeChinese(&content, 46, y, 10, "套餐计价")
		writeASCII(&content, 160, y, 10, data.SourceAmount)
		y -= 21
		writeChinese(&content, 46, y, 10, "锁定汇率")
		writeASCII(&content, 160, y, 9, data.FXRate)
		writeChinese(&content, 350, y, 9, "来源："+data.FXProvider)
		y -= 21
		if data.FXMarkup != "" && data.FXMarkup != "0" {
			writeChinese(&content, 46, y, 10, "汇率调整")
			writeChinese(&content, 160, y, 10, data.FXMarkup+" 个基点")
			y -= 21
		}
		if data.FXQuotedAt != "" {
			writeChinese(&content, 46, y, 10, "汇率时间")
			writeChinese(&content, 160, y, 10, data.FXQuotedAt)
			y -= 26
		}
	}
	writeChinese(&content, 46, y, 10, "开具时间")
	writeChinese(&content, 160, y, 10, data.CreatedAt); y -= 22
	writeChinese(&content, 46, y, 10, "支付期限")
	writeChinese(&content, 160, y, 10, data.DueAt); y -= 22
	if data.PaidAt != "" && data.PaidAt != "—" {
		writeChinese(&content, 46, y, 10, "支付时间")
		writeChinese(&content, 160, y, 10, data.PaidAt); y -= 22
	}
	if data.PaymentMethod != "" {
		writeChinese(&content, 46, y, 10, "支付方式")
		writeChinese(&content, 160, y, 10, data.PaymentMethod); y -= 22
	}
	if data.PaymentReference != "" {
		writeChinese(&content, 46, y, 10, "支付参考号")
		writeASCII(&content, 160, y, 9, data.PaymentReference)
	}

	content.WriteString(fmt.Sprintf("%.4f %.4f %.4f rg 46 220 503 90 re f\n", brandR*0.08+0.92, brandG*0.08+0.92, brandB*0.08+0.92))
	writeChinese(&content, 62, 274, 10, "最终结算金额")
	writeASCII(&content, 62, 240, 24, data.Amount)
	writeChinese(&content, 46, 86, 9, "此账单由 GoJet 自动生成。金额与汇率以账单生成时保存的快照为准。")
	writeASCII(&content, 46, 66, 8, "GoJet")

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

func writeChinese(builder *strings.Builder, x, y, size float64, text string) {
	if strings.TrimSpace(text) == "" { text = "—" }
	builder.WriteString(fmt.Sprintf("BT /F0 %.1f Tf %.1f %.1f Td <%s> Tj ET\n", size, x, y, utf16Hex(text)))
}
func writeASCII(builder *strings.Builder, x, y, size float64, text string) {
	text = strings.ReplaceAll(text, "\\", "\\\\"); text = strings.ReplaceAll(text, "(", "\\("); text = strings.ReplaceAll(text, ")", "\\)")
	builder.WriteString(fmt.Sprintf("BT /F1 %.1f Tf %.1f %.1f Td (%s) Tj ET\n", size, x, y, text))
}
func utf16Hex(text string) string {
	units := utf16.Encode([]rune(text)); var out strings.Builder
	for _, unit := range units { out.WriteString(fmt.Sprintf("%04X", unit)) }
	return out.String()
}
func parseHexColor(value string) (float64,float64,float64) {
	value = strings.TrimPrefix(strings.TrimSpace(value), "#")
	if len(value) != 6 { value = "16A66A" }
	parts := []string{value[0:2],value[2:4],value[4:6]}; nums := make([]int64,3)
	for i,p := range parts { n,err := strconv.ParseInt(p,16,64); if err != nil { return 22.0/255,166.0/255,106.0/255 }; nums[i]=n }
	return float64(nums[0])/255,float64(nums[1])/255,float64(nums[2])/255
}
func buildPDF(objects []string) []byte {
	var out bytes.Buffer; out.WriteString("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"); offsets := make([]int,len(objects)+1)
	for index,object := range objects { offsets[index+1]=out.Len(); fmt.Fprintf(&out,"%d 0 obj\n%s\nendobj\n",index+1,object) }
	xref := out.Len(); fmt.Fprintf(&out,"xref\n0 %d\n0000000000 65535 f \n",len(objects)+1)
	for i:=1;i<=len(objects);i++ { fmt.Fprintf(&out,"%010d 00000 n \n",offsets[i]) }
	fmt.Fprintf(&out,"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n",len(objects)+1,xref)
	return out.Bytes()
}
