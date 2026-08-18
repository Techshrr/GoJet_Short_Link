package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image/color"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/links"
	"github.com/Techshrr/GoJet_Short_Link/app/workspace"
	"github.com/skip2/go-qrcode"
)

type p05LinkPresentation struct {
	Link              links.Link
	UpdatedAt         string
	PasswordProtected bool
}

func (item p05LinkPresentation) MarshalJSON() ([]byte, error) {
	raw, err := json.Marshal(item.Link)
	if err != nil {
		return nil, err
	}
	payload := map[string]any{}
	if err = json.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}
	payload["updated_at"] = item.UpdatedAt
	payload["password_protected"] = item.PasswordProtected
	return json.Marshal(payload)
}

func (s *server) linksP05Capabilities(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工作区编号无效"})
		return
	}
	role, err := s.workspace.Role(r.Context(), workspaceID, currentUser(r).ID)
	if err != nil {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "无权访问该工作区"})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{
		"role":          role,
		"can_view":      workspace.Allowed(role, "view"),
		"can_edit":      workspace.Allowed(role, "edit"),
		"can_analytics": workspace.Allowed(role, "analytics"),
		"can_manage":    workspace.Allowed(role, "manage"),
	})
}

func p05DateBounds(r *http.Request) (*time.Time, *time.Time, error) {
	var from, to *time.Time
	if raw := strings.TrimSpace(r.URL.Query().Get("from")); raw != "" {
		value, err := time.Parse("2006-01-02", raw)
		if err != nil {
			return nil, nil, fmt.Errorf("起始日期格式无效")
		}
		value = value.UTC()
		from = &value
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("to")); raw != "" {
		value, err := time.Parse("2006-01-02", raw)
		if err != nil {
			return nil, nil, fmt.Errorf("结束日期格式无效")
		}
		value = value.UTC().AddDate(0, 0, 1)
		to = &value
	}
	if from != nil && to != nil && !from.Before(*to) {
		return nil, nil, fmt.Errorf("起始日期不能晚于结束日期")
	}
	return from, to, nil
}

func (s *server) listLinksP05(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工作区编号无效"})
		return
	}
	if _, err = s.workspace.Role(r.Context(), workspaceID, currentUser(r).ID); err != nil {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "无权读取链接"})
		return
	}
	from, to, err := p05DateBounds(r)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit < 1 || limit > 100 {
		limit = 25
	}
	if offset < 0 {
		offset = 0
	}
	folderID, _ := strconv.ParseInt(r.URL.Query().Get("folder"), 10, 64)
	campaignID, _ := strconv.ParseInt(r.URL.Query().Get("campaign"), 10, 64)
	tagID, _ := strconv.ParseInt(r.URL.Query().Get("tag"), 10, 64)

	where := `l.workspace_id=? AND l.deleted_at IS NULL`
	args := []any{workspaceID}
	if status := strings.TrimSpace(r.URL.Query().Get("status")); status != "" {
		where += ` AND l.status=?`
		args = append(args, status)
	}
	if search := strings.TrimSpace(r.URL.Query().Get("search")); search != "" {
		where += ` AND (l.code LIKE ? OR l.title LIKE ? OR l.destination LIKE ?)`
		query := "%" + search + "%"
		args = append(args, query, query, query)
	}
	if domain := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(r.URL.Query().Get("domain")), ".")); domain != "" {
		where += ` AND l.domain=?`
		args = append(args, domain)
	}
	if folderID > 0 {
		where += ` AND l.folder_id=?`
		args = append(args, folderID)
	}
	if campaignID > 0 {
		where += ` AND l.campaign_id=?`
		args = append(args, campaignID)
	}
	if tagID > 0 {
		where += ` AND EXISTS(SELECT 1 FROM link_tags selected_tag WHERE selected_tag.link_id=l.id AND selected_tag.tag_id=?)`
		args = append(args, tagID)
	}
	if from != nil {
		where += ` AND l.created_at>=?`
		args = append(args, from.Format("2006-01-02 15:04:05"))
	}
	if to != nil {
		where += ` AND l.created_at<?`
		args = append(args, to.Format("2006-01-02 15:04:05"))
	}

	var total int64
	if err = s.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM short_links l WHERE `+where, args...).Scan(&total); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "链接列表暂时不可用"})
		return
	}

	queryArgs := append(append([]any{}, args...), limit, offset)
	rows, err := s.db.QueryContext(r.Context(), `SELECT l.id,l.workspace_id,l.created_by,l.code,l.domain,l.destination,l.title,l.status,l.redirect_status,l.one_time,l.folder_id,l.campaign_id,COALESCE(f.name,''),COALESCE(c.name,''),COALESCE((SELECT GROUP_CONCAT(t.name ORDER BY t.name SEPARATOR 0x1F) FROM link_tags lt JOIN tags t ON t.id=lt.tag_id WHERE lt.link_id=l.id),''),l.created_at,l.updated_at,IF(COALESCE(l.password_hash,'')='',0,1) FROM short_links l LEFT JOIN folders f ON f.id=l.folder_id LEFT JOIN campaigns c ON c.id=l.campaign_id WHERE `+where+` ORDER BY l.created_at DESC LIMIT ? OFFSET ?`, queryArgs...)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "链接列表暂时不可用"})
		return
	}
	defer rows.Close()

	items := []p05LinkPresentation{}
	for rows.Next() {
		var item p05LinkPresentation
		var tagNames string
		var passwordProtected int
		if err = rows.Scan(&item.Link.ID, &item.Link.WorkspaceID, &item.Link.CreatedBy, &item.Link.Code, &item.Link.Domain, &item.Link.Destination, &item.Link.Title, &item.Link.Status, &item.Link.RedirectStatus, &item.Link.OneTime, &item.Link.FolderID, &item.Link.CampaignID, &item.Link.FolderName, &item.Link.CampaignName, &tagNames, &item.Link.CreatedAt, &item.UpdatedAt, &passwordProtected); err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "链接列表暂时不可用"})
			return
		}
		item.PasswordProtected = passwordProtected == 1
		if tagNames != "" {
			item.Link.TagNames = strings.Split(tagNames, "\x1f")
		}
		item.Link.Clicks, _ = s.redis.Get(r.Context(), "gojet:clicks:"+strconv.FormatInt(item.Link.ID, 10)).Int64()
		item.Link.Visitors, _ = s.redis.PFCount(r.Context(), "gojet:visitors:"+strconv.FormatInt(item.Link.ID, 10)).Result()
		items = append(items, item)
	}
	if err = rows.Err(); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "链接列表暂时不可用"})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"data": items, "total": total, "limit": limit, "offset": offset})
}

func (s *server) getLinkP05(w http.ResponseWriter, r *http.Request) {
	workspaceID, workspaceErr := pathID(r, "id")
	linkID, linkErr := pathID(r, "link")
	if workspaceErr != nil || linkErr != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "链接编号无效"})
		return
	}
	item, err := s.links.Get(r.Context(), currentUser(r).ID, workspaceID, linkID)
	if err != nil {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "链接不存在或无权访问"})
		return
	}
	presentation := p05LinkPresentation{Link: item}
	var protected int
	if err = s.db.QueryRowContext(r.Context(), `SELECT updated_at,IF(COALESCE(password_hash,'')='',0,1) FROM short_links WHERE id=? AND workspace_id=? AND deleted_at IS NULL`, linkID, workspaceID).Scan(&presentation.UpdatedAt, &protected); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "链接详情暂时不可用"})
		return
	}
	presentation.PasswordProtected = protected == 1
	presentation.Link.Clicks, _ = s.redis.Get(r.Context(), "gojet:clicks:"+strconv.FormatInt(linkID, 10)).Int64()
	presentation.Link.Visitors, _ = s.redis.PFCount(r.Context(), "gojet:visitors:"+strconv.FormatInt(linkID, 10)).Result()
	jsonResponse(w, http.StatusOK, presentation)
}

func (s *server) linkP05QR(w http.ResponseWriter, r *http.Request) {
	workspaceID, workspaceErr := pathID(r, "id")
	linkID, linkErr := pathID(r, "link")
	if workspaceErr != nil || linkErr != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "链接编号无效"})
		return
	}
	if _, err := s.workspace.Role(r.Context(), workspaceID, currentUser(r).ID); err != nil {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "无权访问该链接"})
		return
	}
	var code, domain string
	if err := s.db.QueryRowContext(r.Context(), `SELECT code,domain FROM short_links WHERE id=? AND workspace_id=? AND deleted_at IS NULL`, linkID, workspaceID).Scan(&code, &domain); err != nil {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "链接不存在"})
		return
	}

	target := ""
	if strings.TrimSpace(domain) != "" {
		target = "https://" + strings.TrimSpace(domain) + "/" + url.PathEscape(code)
	} else {
		target = strings.TrimRight(getenv("PUBLIC_BASE_URL", "http://localhost:8080"), "/") + "/" + url.PathEscape(code)
	}

	size, _ := strconv.Atoi(r.URL.Query().Get("size"))
	if size < 256 || size > 1600 {
		size = 768
	}
	foregroundHex := strings.TrimSpace(r.URL.Query().Get("foreground"))
	backgroundHex := strings.TrimSpace(r.URL.Query().Get("background"))
	if foregroundHex == "" {
		foregroundHex = "#14231d"
	}
	if backgroundHex == "" {
		backgroundHex = "#ffffff"
	}
	foreground, err := parseShareQRColor(foregroundHex)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "二维码前景色无效"})
		return
	}
	background, err := parseShareQRColor(backgroundHex)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "二维码背景色无效"})
		return
	}
	qr, err := qrcode.New(target, qrcode.Medium)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "无法生成链接二维码"})
		return
	}
	qr.ForegroundColor = foreground
	qr.BackgroundColor = background

	format := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("format")))
	if format == "" {
		format = "png"
	}
	filename := fmt.Sprintf("gojet-link-%d.%s", linkID, format)
	if r.URL.Query().Get("download") == "1" {
		w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	} else {
		w.Header().Set("Content-Disposition", `inline; filename="`+filename+`"`)
	}
	w.Header().Set("Cache-Control", "private, no-store")

	switch format {
	case "png":
		payload, encodeErr := qr.PNG(size)
		if encodeErr != nil {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": "无法生成 PNG 二维码"})
			return
		}
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(payload)
	case "svg":
		w.Header().Set("Content-Type", "image/svg+xml; charset=utf-8")
		_, _ = w.Write(p05QRSVG(qr.Bitmap(), size, foregroundHex, backgroundHex))
	case "pdf":
		w.Header().Set("Content-Type", "application/pdf")
		_, _ = w.Write(p05QRPDF(qr.Bitmap(), size, foreground, background))
	default:
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "二维码导出格式仅支持 PNG、SVG 或 PDF"})
	}
}

func p05QRSVG(bitmap [][]bool, size int, foreground, background string) []byte {
	modules := len(bitmap)
	if modules == 0 {
		return nil
	}
	var out strings.Builder
	fmt.Fprintf(&out, `<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" shape-rendering="crispEdges">`, size, size, modules, modules)
	fmt.Fprintf(&out, `<rect width="%d" height="%d" fill="%s"/>`, modules, modules, background)
	fmt.Fprintf(&out, `<g fill="%s">`, foreground)
	for y, row := range bitmap {
		for x, dark := range row {
			if dark {
				fmt.Fprintf(&out, `<rect x="%d" y="%d" width="1" height="1"/>`, x, y)
			}
		}
	}
	out.WriteString(`</g></svg>`)
	return []byte(out.String())
}

func p05QRPDF(bitmap [][]bool, size int, foreground, background color.Color) []byte {
	modules := len(bitmap)
	if modules == 0 {
		return nil
	}
	fg := color.RGBAModel.Convert(foreground).(color.RGBA)
	bg := color.RGBAModel.Convert(background).(color.RGBA)
	component := func(value uint8) float64 { return float64(value) / 255 }
	moduleSize := float64(size) / float64(modules)

	var stream strings.Builder
	fmt.Fprintf(&stream, "%.6f %.6f %.6f rg\n0 0 %d %d re f\n", component(bg.R), component(bg.G), component(bg.B), size, size)
	fmt.Fprintf(&stream, "%.6f %.6f %.6f rg\n", component(fg.R), component(fg.G), component(fg.B))
	for y, row := range bitmap {
		for x, dark := range row {
			if !dark {
				continue
			}
			xPos := float64(x) * moduleSize
			yPos := float64(modules-y-1) * moduleSize
			fmt.Fprintf(&stream, "%.4f %.4f %.4f %.4f re f\n", xPos, yPos, moduleSize, moduleSize)
		}
	}
	content := stream.String()
	objects := []string{
		`<< /Type /Catalog /Pages 2 0 R >>`,
		`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
		fmt.Sprintf(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] /Resources << >> /Contents 4 0 R >>`, size, size),
		fmt.Sprintf("<< /Length %d >>\nstream\n%sendstream", len(content), content),
	}

	var out bytes.Buffer
	out.WriteString("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")
	offsets := make([]int, len(objects))
	for index, object := range objects {
		offsets[index] = out.Len()
		fmt.Fprintf(&out, "%d 0 obj\n%s\nendobj\n", index+1, object)
	}
	xref := out.Len()
	fmt.Fprintf(&out, "xref\n0 %d\n0000000000 65535 f \n", len(objects)+1)
	for _, offset := range offsets {
		fmt.Fprintf(&out, "%010d 00000 n \n", offset)
	}
	fmt.Fprintf(&out, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(objects)+1, xref)
	return out.Bytes()
}
