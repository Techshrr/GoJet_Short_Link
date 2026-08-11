package billing

import (
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/signintech/gopdf"
)

const invoiceFontName = "gojet-unicode"

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
	FontPath         string
	LogoPath         string
}

// RenderInvoicePDF renders the complete invoice with one embedded Unicode font.
// Chinese, Latin text, numbers and currency symbols therefore use the same font
// metrics instead of relying on PDF viewer fallback fonts.
func RenderInvoicePDF(data InvoicePDFData) ([]byte, error) {
	fontPath := strings.TrimSpace(data.FontPath)
	if fontPath == "" {
		fontPath = strings.TrimSpace(os.Getenv("PDF_FONT_PATH"))
	}
	if fontPath == "" {
		fontPath = filepath.Join("resources", "fonts", "NotoSansSC-VF.ttf")
	}
	if info, err := os.Stat(fontPath); err != nil || info.IsDir() || info.Size() < 1_000_000 {
		if err == nil {
			err = fmt.Errorf("font resource is invalid")
		}
		return nil, fmt.Errorf("PDF Unicode font unavailable at %s: %w", fontPath, err)
	}

	if strings.TrimSpace(data.SiteName) == "" {
		data.SiteName = "GoJet"
	}
	if strings.TrimSpace(data.CompanyName) == "" {
		data.CompanyName = data.SiteName
	}
	status := invoiceStatusLabel(data.Status)
	invoiceType := invoiceTypeLabel(data.InvoiceType)
	brand := parseHexRGB(data.BrandColor)
	ink := rgb{18, 28, 24}
	// PDF text must stay legible after rasterisation, browser zoom and printing.
	// The previous secondary gray was visually elegant on-screen but too light
	// for small CJK strokes in invoice detail and footer copy.
	muted := rgb{52, 64, 59}
	border := rgb{220, 226, 223}
	panel := mixWithWhite(brand, 0.075)
	soft := rgb{247, 249, 248}

	pdf := &gopdf.GoPdf{}
	pdf.Start(gopdf.Config{PageSize: *gopdf.PageSizeA4})
	pdf.AddPage()
	if err := pdf.AddTTFFont(invoiceFontName, fontPath); err != nil {
		return nil, fmt.Errorf("load PDF Unicode font: %w", err)
	}
	writer := invoicePDFWriter{pdf: pdf, font: invoiceFontName}

	// Brand edge and identity header.
	writer.fill(0, 0, 595, 8, brand)
	logoDrawn := writer.logo(data.LogoPath, 46, 34, 148, 42)
	if !logoDrawn {
		if err := writer.text(46, 44, 22, ink, data.SiteName); err != nil { return nil, err }
		writer.fill(46, 72, 36, 3, brand)
	}
	if err := writer.textRight(549, 38, 27, ink, "账单"); err != nil { return nil, err }
	if err := writer.textRight(549, 74, 9.5, muted, "INVOICE"); err != nil { return nil, err }

	writer.line(46, 100, 549, 100, border)
	if err := writer.text(46, 120, 9, muted, "账单编号"); err != nil { return nil, err }
	if err := writer.text(46, 140, 11, ink, data.InvoiceNumber); err != nil { return nil, err }
	if err := writer.text(290, 120, 9, muted, "开具时间"); err != nil { return nil, err }
	if err := writer.text(290, 140, 10, ink, data.CreatedAt); err != nil { return nil, err }

	chipWidth := 74.0
	writer.fill(475, 116, chipWidth, 30, panel)
	if err := writer.textCentered(475, 124, chipWidth, 10, brand, status); err != nil { return nil, err }

	// Service and customer blocks.
	writer.fill(46, 177, 503, 108, soft)
	if err := writer.text(62, 194, 9, muted, "服务方"); err != nil { return nil, err }
	if err := writer.textFit(62, 216, 12, ink, data.CompanyName, 205); err != nil { return nil, err }
	serviceY := 239.0
	if strings.TrimSpace(data.CompanyAddress) != "" {
		if err := writer.textFit(62, serviceY, 9, muted, data.CompanyAddress, 205); err != nil { return nil, err }
		serviceY += 18
	}
	if strings.TrimSpace(data.ContactEmail) != "" {
		if err := writer.textFit(62, serviceY, 9, muted, data.ContactEmail, 205); err != nil { return nil, err }
	}
	writer.line(296, 193, 296, 269, border)
	if err := writer.text(316, 194, 9, muted, "客户 / 工作区"); err != nil { return nil, err }
	if err := writer.textFit(316, 216, 12, ink, data.WorkspaceName, 210); err != nil { return nil, err }
	if err := writer.text(316, 243, 9, muted, "支付期限"); err != nil { return nil, err }
	if err := writer.textFit(316, 261, 9, ink, data.DueAt, 210); err != nil { return nil, err }

	// Item table.
	writer.fill(46, 316, 503, 34, panel)
	for _, col := range []struct{x float64; label string}{{60,"套餐"},{245,"类型"},{355,"服务周期"}} {
		if err := writer.text(col.x, 327, 9.5, muted, col.label); err != nil { return nil, err }
	}
	if err := writer.textRight(535, 327, 9.5, muted, "结算金额"); err != nil { return nil, err }
	if err := writer.textFit(60, 366, 12, ink, data.PlanName, 170); err != nil { return nil, err }
	if err := writer.textFit(245, 366, 11, ink, invoiceType, 95); err != nil { return nil, err }
	if err := writer.textFit(355, 366, 11, ink, data.Period, 90); err != nil { return nil, err }
	if err := writer.textRight(535, 364, 13, ink, data.Amount); err != nil { return nil, err }
	writer.line(46, 398, 549, 398, border)

	// Audit-friendly settlement metadata.
	y := 430.0
	if data.SourceAmount != "" && data.SourceAmount != data.Amount {
		if err := writer.labelValue(46, y, "套餐计价", data.SourceAmount, 340, ink, muted); err != nil { return nil, err }; y += 22
		if err := writer.labelValue(46, y, "锁定汇率", data.FXRate, 340, ink, muted); err != nil { return nil, err }
		if strings.TrimSpace(data.FXProvider) != "" {
			if err := writer.text(378, y, 9.5, muted, "来源"); err != nil { return nil, err }
			if err := writer.textFit(415, y, 9.5, ink, data.FXProvider, 120); err != nil { return nil, err }
		}
		y += 22
		if data.FXMarkup != "" && data.FXMarkup != "0" {
			if err := writer.labelValue(46, y, "汇率调整", data.FXMarkup+" 个基点", 340, ink, muted); err != nil { return nil, err }; y += 22
		}
		if data.FXQuotedAt != "" {
			if err := writer.labelValue(46, y, "汇率时间", data.FXQuotedAt, 340, ink, muted); err != nil { return nil, err }; y += 22
		}
	}
	if data.PaidAt != "" && data.PaidAt != "—" {
		if err := writer.labelValue(46, y, "支付时间", data.PaidAt, 340, ink, muted); err != nil { return nil, err }; y += 22
	}
	if data.PaymentMethod != "" {
		if err := writer.labelValue(46, y, "支付方式", data.PaymentMethod, 340, ink, muted); err != nil { return nil, err }; y += 22
	}
	if data.PaymentReference != "" {
		if err := writer.labelValue(46, y, "支付参考号", data.PaymentReference, 450, ink, muted); err != nil { return nil, err }; y += 22
	}

	summaryY := y + 30
	if summaryY < 575 { summaryY = 575 }
	if summaryY > 650 { summaryY = 650 }
	writer.fill(46, summaryY, 503, 88, panel)
	if err := writer.text(64, summaryY+20, 10, muted, "最终结算金额"); err != nil { return nil, err }
	if err := writer.text(64, summaryY+48, 23, ink, data.Amount); err != nil { return nil, err }
	if err := writer.textRight(531, summaryY+52, 9, brand, status); err != nil { return nil, err }

	footerY := 760.0
	writer.line(46, footerY, 549, footerY, border)
	if err := writer.text(46, footerY+20, 9.2, muted, "此账单由 "+data.SiteName+" 自动生成。金额与汇率以账单生成时保存的快照为准。"); err != nil { return nil, err }
	if err := writer.text(46, footerY+40, 8.8, muted, data.CompanyName); err != nil { return nil, err }

	output, err := pdf.GetBytesPdfReturnErr()
	if err != nil { return nil, fmt.Errorf("finalize invoice PDF: %w", err) }
	if len(output) < 1500 || !strings.HasPrefix(string(output[:minInt(len(output), 5)]), "%PDF-") {
		return nil, fmt.Errorf("generated invoice PDF is invalid")
	}
	return output, nil
}

type rgb struct{ r, g, b uint8 }

type invoicePDFWriter struct {
	pdf *gopdf.GoPdf
	font string
}

func (w invoicePDFWriter) setFont(size float64, color rgb) error {
	if err := w.pdf.SetFont(w.font, "", size); err != nil { return fmt.Errorf("set invoice font: %w", err) }
	w.pdf.SetTextColor(color.r, color.g, color.b)
	return nil
}
func (w invoicePDFWriter) text(x,y,size float64,color rgb,text string) error {
	if strings.TrimSpace(text)=="" { return nil }
	if err:=w.setFont(size,color);err!=nil{return err}
	w.pdf.SetXY(x,y)
	if err:=w.pdf.Cell(nil,text);err!=nil{return fmt.Errorf("render invoice text: %w",err)}
	return nil
}
func (w invoicePDFWriter) textRight(right,y,size float64,color rgb,text string) error {
	if strings.TrimSpace(text)=="" { return nil }
	if err:=w.setFont(size,color);err!=nil{return err}
	width,err:=w.pdf.MeasureTextWidth(text);if err!=nil{return err}
	return w.text(right-width,y,size,color,text)
}
func (w invoicePDFWriter) textCentered(x,y,width,size float64,color rgb,text string) error {
	if strings.TrimSpace(text)=="" { return nil }
	if err:=w.setFont(size,color);err!=nil{return err}
	textWidth,err:=w.pdf.MeasureTextWidth(text);if err!=nil{return err}
	return w.text(x+(width-textWidth)/2,y,size,color,text)
}
func (w invoicePDFWriter) textFit(x,y,size float64,color rgb,text string,maxWidth float64) error {
	if strings.TrimSpace(text)=="" { return nil }
	if err:=w.setFont(size,color);err!=nil{return err}
	fitted:=text
	width,err:=w.pdf.MeasureTextWidth(fitted);if err!=nil{return err}
	if width>maxWidth {
		runes:=[]rune(text)
		for len(runes)>1 {
			runes=runes[:len(runes)-1]
			fitted=string(runes)+"…"
			width,err=w.pdf.MeasureTextWidth(fitted);if err!=nil{return err}
			if width<=maxWidth { break }
		}
	}
	return w.text(x,y,size,color,fitted)
}
func (w invoicePDFWriter) labelValue(x,y float64,label,value string,maxWidth float64,ink,muted rgb) error {
	if err:=w.text(x,y,9.5,muted,label);err!=nil{return err}
	return w.textFit(x+82,y,9.5,ink,value,maxWidth)
}
func (w invoicePDFWriter) fill(x,y,width,height float64,color rgb) {
	w.pdf.SetFillColor(color.r,color.g,color.b)
	w.pdf.SetStrokeColor(color.r,color.g,color.b)
	w.pdf.RectFromUpperLeftWithStyle(x,y,width,height,"F")
}
func (w invoicePDFWriter) line(x1,y1,x2,y2 float64,color rgb) {
	w.pdf.SetStrokeColor(color.r,color.g,color.b)
	w.pdf.SetLineWidth(0.7)
	w.pdf.Line(x1,y1,x2,y2)
}
func (w invoicePDFWriter) logo(path string,x,y,maxW,maxH float64) bool {
	path=strings.TrimSpace(path);if path==""{return false}
	ext:=strings.ToLower(filepath.Ext(path));if ext!=".png"&&ext!=".jpg"&&ext!=".jpeg"{return false}
	file,err:=os.Open(path);if err!=nil{return false};defer file.Close()
	cfg,_,err:=image.DecodeConfig(file);if err!=nil||cfg.Width<=0||cfg.Height<=0{return false}
	ratio:=float64(cfg.Width)/float64(cfg.Height);width,height:=maxW,maxW/ratio
	if height>maxH {height=maxH;width=maxH*ratio}
	holder,err:=gopdf.ImageHolderByPath(path);if err!=nil{return false}
	if err=w.pdf.ImageByHolder(holder,x,y,&gopdf.Rect{W:width,H:height});err!=nil{return false}
	return true
}

func invoiceStatusLabel(status string) string {
	if value:=map[string]string{"pending":"待支付","paid":"已支付","void":"已作废","overdue":"已逾期"}[status];value!=""{return value}
	if strings.TrimSpace(status)==""{return "待处理"};return status
}
func invoiceTypeLabel(value string) string {
	if label:=map[string]string{"purchase":"购买套餐","upgrade":"变更套餐","renewal":"续费"}[value];label!=""{return label}
	return value
}
func parseHexRGB(value string) rgb {
	value=strings.TrimPrefix(strings.TrimSpace(value),"#");if len(value)!=6{value="16A66A"}
	parts:=[]string{value[:2],value[2:4],value[4:]};out:=rgb{}
	values:=[]*uint8{&out.r,&out.g,&out.b}
	for i,part:=range parts {n,err:=strconv.ParseUint(part,16,8);if err!=nil{return rgb{22,166,106}};*values[i]=uint8(n)}
	return out
}
func mixWithWhite(color rgb, strength float64) rgb {
	mix:=func(v uint8)uint8{return uint8(255-(255-float64(v))*strength)}
	return rgb{mix(color.r),mix(color.g),mix(color.b)}
}
func minInt(a,b int)int{if a<b{return a};return b}
