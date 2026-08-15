package main

import (
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"image/color"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/skip2/go-qrcode"
)

type shareQRRequest struct {
	Kind       string `json:"kind"`
	ResourceID int64  `json:"resource_id"`
	Size       int    `json:"size"`
	Foreground string `json:"foreground"`
	Background string `json:"background"`
}

func (s *server) createShareQR(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工作区编号无效"})
		return
	}
	if _, err = s.workspace.Role(r.Context(), workspaceID, currentUser(r).ID); err != nil {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "无权访问该工作区资源"})
		return
	}
	var input shareQRRequest
	if decode(w, r, &input) != nil {
		return
	}
	if input.ResourceID <= 0 {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "分享资源编号无效"})
		return
	}
	target, err := s.shareQRTarget(r, workspaceID, input.Kind, input.ResourceID)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	if input.Size < 256 || input.Size > 1600 {
		input.Size = 768
	}
	if strings.TrimSpace(input.Foreground) == "" {
		input.Foreground = "#14231d"
	}
	if strings.TrimSpace(input.Background) == "" {
		input.Background = "#ffffff"
	}
	foreground, err := parseShareQRColor(input.Foreground)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "二维码前景色无效"})
		return
	}
	background, err := parseShareQRColor(input.Background)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "二维码背景色无效"})
		return
	}
	qr, err := qrcode.New(target, qrcode.Medium)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "无法生成分享二维码"})
		return
	}
	qr.ForegroundColor = foreground
	qr.BackgroundColor = background
	png, err := qr.PNG(input.Size)
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": "无法生成分享二维码"})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{
		"kind":           strings.ToLower(strings.TrimSpace(input.Kind)),
		"resource_id":    input.ResourceID,
		"target":         target,
		"image_data_url": "data:image/png;base64," + base64.StdEncoding.EncodeToString(png),
		"size":           input.Size,
	})
}

func (s *server) shareQRTarget(r *http.Request, workspaceID int64, kind string, resourceID int64) (string, error) {
	kind = strings.ToLower(strings.TrimSpace(kind))
	var slug string
	var expires sql.NullTime
	now := time.Now().UTC()
	switch kind {
	case "text":
		err := s.db.QueryRowContext(r.Context(), `SELECT slug,expires_at FROM text_shares WHERE id=? AND workspace_id=? AND deleted_at IS NULL AND status='active'`, resourceID, workspaceID).Scan(&slug, &expires)
		if err != nil {
			return "", errors.New("文本分享不存在或当前不可公开访问")
		}
		if expires.Valid && !expires.Time.After(now) {
			return "", errors.New("文本分享已过期，不能生成二维码")
		}
		return s.firstPartyShareURL("/t/" + url.PathEscape(slug))
	case "bio":
		err := s.db.QueryRowContext(r.Context(), `SELECT slug FROM bio_pages WHERE id=? AND workspace_id=? AND deleted_at IS NULL AND status='published'`, resourceID, workspaceID).Scan(&slug)
		if err != nil {
			return "", errors.New("个人主页尚未发布或当前不可公开访问")
		}
		return s.firstPartyShareURL("/p/" + url.PathEscape(slug))
	case "file":
		var maxDownloads sql.NullInt64
		var downloads int64
		err := s.db.QueryRowContext(r.Context(), `SELECT slug,expires_at,max_downloads,downloads FROM file_shares WHERE id=? AND workspace_id=? AND deleted_at IS NULL AND scan_status='clean' AND status='active'`, resourceID, workspaceID).Scan(&slug, &expires, &maxDownloads, &downloads)
		if err != nil {
			return "", errors.New("文件尚未通过安全检查或当前不可公开下载")
		}
		if expires.Valid && !expires.Time.After(now) {
			return "", errors.New("文件分享已过期，不能生成二维码")
		}
		if maxDownloads.Valid && downloads >= maxDownloads.Int64 {
			return "", errors.New("文件下载次数已用完，不能生成二维码")
		}
		return s.firstPartyShareURL("/f/" + url.PathEscape(slug))
	default:
		return "", errors.New("该资源类型不支持二维码分享")
	}
}

func (s *server) firstPartyShareURL(path string) (string, error) {
	base := strings.TrimRight(getenv("PUBLIC_BASE_URL", "http://localhost:8080"), "/")
	target := base + path
	parsed, err := url.ParseRequestURI(target)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "", errors.New("公开访问地址配置无效")
	}
	return target, nil
}

func parseShareQRColor(value string) (color.Color, error) {
	var red, green, blue uint8
	if _, err := fmt.Sscanf(strings.TrimSpace(value), "#%02x%02x%02x", &red, &green, &blue); err != nil {
		return nil, err
	}
	return color.RGBA{R: red, G: green, B: blue, A: 255}, nil
}
