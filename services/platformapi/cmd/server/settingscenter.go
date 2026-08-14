package main

import (
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

var settingSections = map[string]map[string]bool{
	"brand": {"brand.primary_color": true},
	"basic": {
		"site.name": true, "site.short_name": true, "site.tagline": true, "site.description": true,
		"site.language": true, "site.timezone": true, "site.contact_email": true, "site.support_email": true,
		"site.company_name": true, "site.company_address": true, "site.copyright": true,
	},
	"seo": {
		"seo.default_title": true, "seo.title_template": true, "seo.meta_description": true,
		"seo.meta_keywords": true, "seo.canonical_url": true, "seo.open_graph": true,
		"seo.twitter_card": true, "seo.robots": true, "seo.sitemap": true, "seo.verification": true,
	},
	"registration": {
		"registration.enabled": true, "registration.require_email_verification": true,
		"registration.password_min_length": true, "registration.login_rate_limit": true,
		"registration.forgot_password": true, "registration.invitation_only": true,
		"registration.blocked_domains": true, "registration.admin_mfa": true,
		"turnstile.site_key": true, "turnstile.secret": true,
	},
	"links": {
		"links.default_domain": true, "links.default_redirect_status": true, "links.code_length": true,
		"links.allowed_characters": true, "links.reserved_codes": true, "links.blocked_keywords": true,
		"links.anonymous_creation": true, "links.default_expiry_days": true,
		"links.default_click_limit": true, "links.force_https": true, "links.safe_browsing": true,
	},
	"privacy": {
		"analytics.enabled": true, "analytics.retention_days": true, "analytics.record_full_referer": true,
		"analytics.record_city": true, "analytics.exclude_bots": true, "analytics.visitor_window_hours": true,
		"privacy.cookie_policy": true, "privacy.periodic_cleanup": true,
	},
	"runtime": {"api.enabled": true, "cache.enabled": true, "cache.default_ttl_seconds": true},
}

var sensitiveSettings = map[string]bool{"turnstile.secret": true}
var brandAssets = map[string]string{
	"logo": "brand.logo_url",
	"favicon": "brand.favicon_url",
}

func canonicalSettingSection(key string) (string, bool) {
	for section, keys := range settingSections {
		if keys[key] {
			return section, true
		}
	}
	return "", false
}

func (s *server) saveSettingsSection(w http.ResponseWriter, r *http.Request) {
	requestedSection := r.PathValue("section")
	if _, ok := settingSections[requestedSection]; !ok {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "未知设置分组"})
		return
	}
	var values map[string]any
	if decode(w, r, &values) != nil {
		return
	}

	canonicalGroups := map[string]map[string]any{}
	for key, value := range values {
		section, ok := canonicalSettingSection(key)
		if !ok {
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "不允许的设置项: " + key})
			return
		}
		if canonicalGroups[section] == nil {
			canonicalGroups[section] = map[string]any{}
		}
		canonicalGroups[section][key] = value
	}

	if registration := canonicalGroups["registration"]; truthy(registration["registration.require_email_verification"]) {
		var status string
		if err := s.db.QueryRowContext(r.Context(), `SELECT status FROM mail_health WHERE singleton_id=1`).Scan(&status); err != nil || status != "connected" {
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "SMTP 测试邮件成功前不能开启强制邮箱验证"})
			return
		}
	}
	if links := canonicalGroups["links"]; links != nil {
		if err := validateLinkSettings(links); err != nil {
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
	}
	if runtime := canonicalGroups["runtime"]; runtime != nil {
		if err := validateRuntimeSettings(runtime); err != nil {
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
	}
	if announcements := canonicalGroups["announcementbar"]; announcements != nil {
		if err := validateAnnouncementSettings(announcements); err != nil {
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		// The validator normalizes IDs, tone and numeric fields. Persist the
		// validated canonical values rather than the untrusted request shape.
		for key, value := range announcements {
			values[key] = value
		}
	}
	for key, raw := range values {
		encoded, err := encodeSetting(raw)
		if err != nil {
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "设置格式无效: " + key})
			return
		}
		if err = s.settings.Set(r.Context(), key, encoded, sensitiveSettings[key]); err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "设置保存失败"})
			return
		}
	}
	groups := make([]string, 0, len(canonicalGroups))
	for group := range canonicalGroups {
		groups = append(groups, group)
	}
	sort.Strings(groups)
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.settings_updated','settings',?,JSON_OBJECT('keys',?,'canonical_sections',?))`, requestedSection, strings.Join(mapKeys(values), ","), strings.Join(groups, ","))
	s.invalidatePublicSettings(r.Context())
	jsonResponse(w, http.StatusOK, map[string]any{"saved": true, "section": requestedSection, "canonical_sections": groups})
}

func (s *server) getSettingsCenter(w http.ResponseWriter, r *http.Request) {
	out := map[string]map[string]any{}
	for section, keys := range settingSections {
		values := map[string]any{}
		for key := range keys {
			stored, exists, err := s.settings.Get(r.Context(), key)
			if err != nil {
				jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "设置读取失败: " + key})
				return
			}
			if !exists {
				continue
			}
			if sensitiveSettings[key] {
				values[key] = "********"
			} else {
				values[key] = decodeSetting(stored)
			}
		}
		out[section] = values
	}

	brand := out["brand"]
	if brand == nil {
		brand = map[string]any{}
	}
	for asset, key := range brandAssets {
		stored, exists, err := s.settings.Get(r.Context(), key)
		if err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "品牌设置读取失败: " + asset})
			return
		}
		if exists {
			brand[asset] = stored
		}
	}
	out["brand"] = brand

	mailConfig, err := s.mail.ConfigStrict(r.Context())
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "SMTP 设置读取失败: " + err.Error()})
		return
	}
	out["mail"] = map[string]any{
		"host": mailConfig.Host, "port": mailConfig.Port, "username": mailConfig.Username,
		"encryption": mailConfig.Encryption, "ehlo": mailConfig.EHLO,
		"from_email": mailConfig.FromEmail, "from_name": mailConfig.FromName,
		"reply_to": mailConfig.ReplyTo, "password_configured": mailConfig.Password != "",
	}
	jsonResponse(w, http.StatusOK, out)
}

func (s *server) uploadBrandAsset(w http.ResponseWriter, r *http.Request) {
	asset := r.PathValue("asset")
	settingKey, ok := brandAssets[asset]
	if !ok {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "未知品牌资产"})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 6<<20)
	if err := r.ParseMultipartForm(5 << 20); err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "文件不能超过 5MB"})
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "请选择文件"})
		return
	}
	defer file.Close()
	mimeType, ext, err := validateImage(file, header)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	if _, err = file.Seek(0, io.SeekStart); err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "无法读取文件"})
		return
	}

	storage := getenv("BRAND_ASSET_PATH", "/data/brand")
	if err = os.MkdirAll(storage, 0755); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "品牌图片目录不可用"})
		return
	}
	name := asset + ext
	target := filepath.Join(storage, name)
	tmp := target + ".uploading"
	output, err := os.OpenFile(tmp, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0644)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "品牌图片存储失败"})
		return
	}
	_, copyErr := io.Copy(output, file)
	closeErr := output.Close()
	if copyErr != nil || closeErr != nil {
		_ = os.Remove(tmp)
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "品牌图片存储失败"})
		return
	}
	if err = os.Rename(tmp, target); err != nil {
		_ = os.Remove(tmp)
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "品牌图片替换失败"})
		return
	}

	publicURL := "/assets/images/" + name
	old, _, _ := s.settings.Get(r.Context(), settingKey)
	if err = s.settings.Set(r.Context(), settingKey, publicURL, false); err != nil {
		_ = os.Remove(target)
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "品牌设置保存失败"})
		return
	}
	removeOldBrandAsset(storage, getenv("UPLOAD_STORAGE_PATH", "/data/uploads"), old, publicURL)
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.brand_uploaded','brand',?,JSON_OBJECT('url',?,'mime',?))`, asset, publicURL, mimeType)
	s.invalidatePublicSettings(r.Context())
	jsonResponse(w, http.StatusCreated, map[string]string{"asset": asset, "url": publicURL, "mime_type": mimeType})
}

func (s *server) deleteBrandAsset(w http.ResponseWriter, r *http.Request) {
	asset := r.PathValue("asset")
	key, ok := brandAssets[asset]
	if !ok {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "未知品牌资产"})
		return
	}
	old, exists, err := s.settings.Get(r.Context(), key)
	if err != nil || !exists {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "品牌资产不存在"})
		return
	}
	if _, err = s.db.ExecContext(r.Context(), `DELETE FROM system_settings WHERE setting_key=?`, key); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "删除失败"})
		return
	}
	removeOldBrandAsset(getenv("BRAND_ASSET_PATH", "/data/brand"), getenv("UPLOAD_STORAGE_PATH", "/data/uploads"), old, "")
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id) VALUES('admin.brand_deleted','brand',?)`, asset)
	s.invalidatePublicSettings(r.Context())
	w.WriteHeader(http.StatusNoContent)
}

func validateImage(file multipart.File, header *multipart.FileHeader) (string, string, error) {
	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		return "", "", err
	}
	mimeType := http.DetectContentType(buffer[:n])
	extensions := map[string]string{
		"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif",
		"image/x-icon": ".ico", "image/vnd.microsoft.icon": ".ico",
	}
	ext, ok := extensions[mimeType]
	if !ok {
		return "", "", fmt.Errorf("仅支持 PNG、JPEG、WebP、GIF 或 ICO 图片")
	}
	if header.Size > 5<<20 {
		return "", "", fmt.Errorf("文件不能超过 5MB")
	}
	return mimeType, ext, nil
}

func removeOldBrandAsset(brandStorage, uploadStorage, oldPublicURL, keepPublicURL string) {
	if oldPublicURL == "" || oldPublicURL == keepPublicURL {
		return
	}
	var storage, prefix string
	switch {
	case strings.HasPrefix(oldPublicURL, "/assets/images/"):
		storage, prefix = brandStorage, "/assets/images/"
	case strings.HasPrefix(oldPublicURL, "/uploads/"):
		storage, prefix = uploadStorage, "/uploads/"
	default:
		return
	}
	name := strings.TrimPrefix(oldPublicURL, prefix)
	if name == "" || filepath.Base(name) != name {
		return
	}
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

func truthy(value any) bool {
	result, ok := value.(bool)
	return ok && result
}

func mapKeys(values map[string]any) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func validateLinkSettings(values map[string]any) error {
	number := func(key string, min, max int) error {
		value, ok := values[key]
		if !ok {
			return nil
		}
		raw, ok := value.(float64)
		if !ok || int(raw) < min || int(raw) > max {
			return fmt.Errorf("%s 必须为 %d 到 %d", key, min, max)
		}
		return nil
	}
	if err := number("links.default_redirect_status", 301, 308); err != nil {
		return err
	}
	if value, ok := values["links.default_redirect_status"].(float64); ok && value != 301 && value != 302 && value != 307 && value != 308 {
		return fmt.Errorf("默认跳转状态码只允许 301、302、307 或 308")
	}
	if err := number("links.code_length", 3, 32); err != nil {
		return err
	}
	if err := number("links.default_expiry_days", 0, 3650); err != nil {
		return err
	}
	if err := number("links.default_click_limit", 0, 1_000_000_000); err != nil {
		return err
	}
	if value, ok := values["links.allowed_characters"].(string); ok {
		if len(value) < 2 || len(value) > 128 {
			return fmt.Errorf("短码字符集必须包含 2 到 128 个字符")
		}
		for _, char := range value {
			if char > 127 || strings.ContainsRune(" /?#", char) {
				return fmt.Errorf("短码字符集只能使用安全 ASCII 字符")
			}
		}
	}
	return nil
}

func validateRuntimeSettings(values map[string]any) error {
	for _, key := range []string{"api.enabled", "cache.enabled"} {
		if value, ok := values[key]; ok {
			if _, valid := value.(bool); !valid {
				return fmt.Errorf("%s 必须为布尔值", key)
			}
		}
	}
	if value, ok := values["cache.default_ttl_seconds"]; ok {
		raw, valid := value.(float64)
		if !valid || raw < 10 || raw > 86400 || raw != float64(int(raw)) {
			return fmt.Errorf("缓存 TTL 必须为 10 到 86400 秒的整数")
		}
	}
	return nil
}