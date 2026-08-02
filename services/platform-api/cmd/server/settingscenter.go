package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

var settingSections = map[string]map[string]bool{
	"brand":        {"brand.primary_color": true},
	"basic":        {"site.name": true, "site.short_name": true, "site.tagline": true, "site.description": true, "site.language": true, "site.timezone": true, "site.contact_email": true, "site.support_email": true, "site.company_name": true, "site.company_address": true, "site.copyright": true},
	"seo":          {"seo.default_title": true, "seo.title_template": true, "seo.meta_description": true, "seo.meta_keywords": true, "seo.canonical_url": true, "seo.open_graph": true, "seo.twitter_card": true, "seo.robots": true, "seo.sitemap": true, "seo.verification": true},
	"registration": {"registration.enabled": true, "registration.require_email_verification": true, "registration.password_min_length": true, "registration.login_rate_limit": true, "registration.forgot_password": true, "registration.invitation_only": true, "registration.blocked_domains": true, "registration.admin_mfa": true, "turnstile.site_key": true, "turnstile.secret": true},
	"links":        {"links.default_domain": true, "links.default_redirect_status": true, "links.code_length": true, "links.allowed_characters": true, "links.reserved_codes": true, "links.blocked_keywords": true, "links.anonymous_creation": true, "links.default_expiry_days": true, "links.default_click_limit": true, "links.force_https": true, "links.safe_browsing": true},
	"privacy":      {"analytics.enabled": true, "analytics.retention_days": true, "analytics.record_full_referer": true, "analytics.record_city": true, "analytics.exclude_bots": true, "analytics.visitor_window_hours": true, "privacy.cookie_policy": true, "privacy.periodic_cleanup": true},
}
var sensitiveSettings = map[string]bool{"turnstile.secret": true}
var brandAssets = map[string]string{"logo": "brand.logo_url", "logo-dark": "brand.logo_dark_url", "logo-light": "brand.logo_light_url", "logo-square": "brand.logo_square_url", "favicon": "brand.favicon_url", "apple-touch-icon": "brand.apple_touch_icon_url", "pwa-icon": "brand.pwa_icon_url", "share-image": "brand.share_image_url", "login-image": "brand.login_image_url", "mail-logo": "brand.mail_logo_url"}

func (s *server) saveSettingsSection(w http.ResponseWriter, r *http.Request) {
	section := r.PathValue("section")
	allowed, ok := settingSections[section]
	if !ok {
		jsonResponse(w, 404, map[string]string{"error": "未知设置分组"})
		return
	}
	var values map[string]any
	if decode(w, r, &values) != nil {
		return
	}
	if section == "registration" && truthy(values["registration.require_email_verification"]) {
		var status string
		if err := s.db.QueryRowContext(r.Context(), `SELECT status FROM mail_health WHERE singleton_id=1`).Scan(&status); err != nil || status != "connected" {
			jsonResponse(w, 422, map[string]string{"error": "SMTP 测试邮件成功前不能开启强制邮箱验证"})
			return
		}
	}
	for key, value := range values {
		if !allowed[key] {
			jsonResponse(w, 422, map[string]string{"error": "不允许的设置项: " + key})
			return
		}
		encoded, err := encodeSetting(value)
		if err != nil {
			jsonResponse(w, 422, map[string]string{"error": "设置格式无效: " + key})
			return
		}
		if err = s.settings.Set(r.Context(), key, encoded, sensitiveSettings[key]); err != nil {
			jsonResponse(w, 503, map[string]string{"error": "设置保存失败"})
			return
		}
	}
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.settings_updated','settings',?,JSON_OBJECT('keys',?))`, section, strings.Join(mapKeys(values), ","))
	jsonResponse(w, 200, map[string]any{"saved": true, "section": section})
}
func (s *server) getSettingsCenter(w http.ResponseWriter, r *http.Request) {
	out := map[string]map[string]any{}
	for section, keys := range settingSections {
		values := map[string]any{}
		for key := range keys {
			value, exists, err := s.settings.Get(r.Context(), key)
			if err != nil {
				jsonResponse(w, 503, map[string]string{"error": "设置读取失败"})
				return
			}
			if exists {
				if sensitiveSettings[key] {
					values[key] = "********"
				} else {
					values[key] = decodeSetting(value)
				}
			}
		}
		out[section] = values
	}
	brand := out["brand"]
	if brand == nil {
		brand = map[string]any{}
	}
	for asset, key := range brandAssets {
		if value, exists, _ := s.settings.Get(r.Context(), key); exists {
			brand[asset] = value
		}
	}
	out["brand"] = brand
	jsonResponse(w, 200, out)
}
func (s *server) uploadBrandAsset(w http.ResponseWriter, r *http.Request) {
	asset := r.PathValue("asset")
	settingKey, ok := brandAssets[asset]
	if !ok {
		jsonResponse(w, 404, map[string]string{"error": "未知品牌资产"})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 6<<20)
	if err := r.ParseMultipartForm(5 << 20); err != nil {
		jsonResponse(w, 422, map[string]string{"error": "文件不能超过 5MB"})
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": "请选择文件"})
		return
	}
	defer file.Close()
	mime, ext, err := validateImage(file, header)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	if _, err = file.Seek(0, io.SeekStart); err != nil {
		jsonResponse(w, 422, map[string]string{"error": "无法读取文件"})
		return
	}
	storage := getenv("UPLOAD_STORAGE_PATH", "/data/uploads")
	if err = os.MkdirAll(storage, 0755); err != nil {
		jsonResponse(w, 503, map[string]string{"error": "存储目录不可用"})
		return
	}
	random := make([]byte, 16)
	_, _ = rand.Read(random)
	name := asset + "-" + hex.EncodeToString(random) + ext
	target := filepath.Join(storage, name)
	output, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "文件存储失败"})
		return
	}
	_, copyErr := io.Copy(output, file)
	closeErr := output.Close()
	if copyErr != nil || closeErr != nil {
		_ = os.Remove(target)
		jsonResponse(w, 503, map[string]string{"error": "文件存储失败"})
		return
	}
	publicURL := "/uploads/" + name
	old, _, _ := s.settings.Get(r.Context(), settingKey)
	if err = s.settings.Set(r.Context(), settingKey, publicURL, false); err != nil {
		_ = os.Remove(target)
		jsonResponse(w, 503, map[string]string{"error": "品牌设置保存失败"})
		return
	}
	removeOldUpload(storage, old)
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.brand_uploaded','brand',?,JSON_OBJECT('url',?,'mime',?))`, asset, publicURL, mime)
	jsonResponse(w, 201, map[string]string{"asset": asset, "url": publicURL, "mime_type": mime})
}
func (s *server) deleteBrandAsset(w http.ResponseWriter, r *http.Request) {
	asset := r.PathValue("asset")
	key, ok := brandAssets[asset]
	if !ok {
		jsonResponse(w, 404, map[string]string{"error": "未知品牌资产"})
		return
	}
	old, exists, err := s.settings.Get(r.Context(), key)
	if err != nil || !exists {
		jsonResponse(w, 404, map[string]string{"error": "品牌资产不存在"})
		return
	}
	if _, err = s.db.ExecContext(r.Context(), `DELETE FROM system_settings WHERE setting_key=?`, key); err != nil {
		jsonResponse(w, 503, map[string]string{"error": "删除失败"})
		return
	}
	removeOldUpload(getenv("UPLOAD_STORAGE_PATH", "/data/uploads"), old)
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id) VALUES('admin.brand_deleted','brand',?)`, asset)
	w.WriteHeader(http.StatusNoContent)
}
func validateImage(file multipart.File, header *multipart.FileHeader) (string, string, error) {
	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		return "", "", err
	}
	mime := http.DetectContentType(buffer[:n])
	extensions := map[string]string{"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif", "image/x-icon": ".ico", "image/vnd.microsoft.icon": ".ico"}
	ext, ok := extensions[mime]
	if !ok {
		return "", "", fmt.Errorf("仅支持 PNG、JPEG、WebP、GIF 或 ICO 图片")
	}
	if header.Size > 5<<20 {
		return "", "", fmt.Errorf("文件不能超过 5MB")
	}
	return mime, ext, nil
}
func removeOldUpload(storage, publicURL string) {
	if !strings.HasPrefix(publicURL, "/uploads/") {
		return
	}
	name := filepath.Base(publicURL)
	path := filepath.Join(storage, name)
	if filepath.Dir(path) == filepath.Clean(storage) {
		_ = os.Remove(path)
	}
}
func encodeSetting(value any) (string, error) {
	data, err := json.Marshal(value)
	return string(data), err
}
func decodeSetting(value string) any {
	var decoded any
	if json.Unmarshal([]byte(value), &decoded) == nil {
		return decoded
	}
	return value
}
func truthy(value any) bool { result, ok := value.(bool); return ok && result }
func mapKeys(values map[string]any) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	return keys
}
