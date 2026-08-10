package main

import (
	"database/sql"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
)

func validAbuseReason(reason string) bool {
	switch reason {
	case "malware", "phishing", "spam", "copyright", "other":
		return true
	default:
		return false
	}
}

func normalizeReportedURL(raw string) (string, string, string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" || len(raw) > 2048 {
		return "", "", "", false
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" || u.User != nil {
		return "", "", "", false
	}
	if u.RawQuery != "" || u.Fragment != "" {
		u.RawQuery = ""
		u.Fragment = ""
	}
	path := strings.Trim(u.EscapedPath(), "/")
	if path == "" || strings.Contains(path, "/") {
		return "", "", "", false
	}
	code, err := url.PathUnescape(path)
	if err != nil || strings.TrimSpace(code) == "" || len(code) > 64 || strings.ContainsAny(code, "/\\") {
		return "", "", "", false
	}
	for _, r := range code {
		if r < 0x20 || r == 0x7f {
			return "", "", "", false
		}
	}
	u.Path = "/" + code
	u.RawPath = ""
	return u.String(), strings.ToLower(strings.TrimSuffix(u.Hostname(), ".")), code, true
}

func (s *server) resolveReportedLinkID(r *http.Request, hostname, code string) *int64 {
	publicHost := ""
	if base, err := url.Parse(strings.TrimSpace(getenv("PUBLIC_BASE_URL", ""))); err == nil {
		publicHost = strings.ToLower(strings.TrimSuffix(base.Hostname(), "."))
	}
	var id int64
	var err error
	if hostname == publicHost && publicHost != "" {
		err = s.db.QueryRowContext(r.Context(), `SELECT id FROM short_links WHERE code=? AND deleted_at IS NULL AND (domain='' OR LOWER(domain)=?) ORDER BY (domain='') DESC LIMIT 1`, code, hostname).Scan(&id)
	} else {
		err = s.db.QueryRowContext(r.Context(), `SELECT id FROM short_links WHERE code=? AND deleted_at IS NULL AND LOWER(domain)=? LIMIT 1`, code, hostname).Scan(&id)
	}
	if err != nil {
		return nil
	}
	return &id
}

func (s *server) createPublicAbuseReport(w http.ResponseWriter, r *http.Request) {
	var in struct {
		URL            string `json:"url"`
		ReporterEmail  string `json:"reporter_email"`
		Reason         string `json:"reason"`
		Details        string `json:"details"`
		TurnstileToken string `json:"turnstile_token"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if !s.enforceTurnstile(w, r, "abuse_report", "abuse_report", in.TurnstileToken) {
		return
	}
	reportedURL, hostname, code, ok := normalizeReportedURL(in.URL)
	if !ok {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "请输入有效的 GoJet 短链接 URL"})
		return
	}
	in.Reason = strings.TrimSpace(in.Reason)
	if !validAbuseReason(in.Reason) {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "请选择有效的举报原因"})
		return
	}
	in.ReporterEmail = strings.TrimSpace(in.ReporterEmail)
	if len(in.ReporterEmail) > 320 {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "联系邮箱格式无效"})
		return
	}
	if in.ReporterEmail != "" {
		address, err := mail.ParseAddress(in.ReporterEmail)
		if err != nil || !strings.EqualFold(strings.TrimSpace(address.Address), in.ReporterEmail) {
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "联系邮箱格式无效"})
			return
		}
	}
	in.Details = strings.TrimSpace(in.Details)
	if len(in.Details) > 5000 {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "补充说明不能超过 5000 个字符"})
		return
	}
	linkID := s.resolveReportedLinkID(r, hostname, code)
	var result sql.Result
	var err error
	if linkID == nil {
		result, err = s.db.ExecContext(r.Context(), `INSERT INTO abuse_reports(link_id,reported_url,reporter_email,reason,details,status) VALUES(NULL,?,?,?,?, 'open')`, reportedURL, nullableString(in.ReporterEmail), in.Reason, nullableString(in.Details))
	} else {
		result, err = s.db.ExecContext(r.Context(), `INSERT INTO abuse_reports(link_id,reported_url,reporter_email,reason,details,status) VALUES(?,?,?,?,?, 'open')`, *linkID, reportedURL, nullableString(in.ReporterEmail), in.Reason, nullableString(in.Details))
	}
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "举报暂时无法提交，请稍后重试"})
		return
	}
	id, _ := result.LastInsertId()
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO security_events(event_type,severity,source,description,status) VALUES('public_abuse_report','warning',?,?,'open')`, reportedURL, "收到公开滥用举报 #"+formatInt64(id))
	// Always return the same acknowledgement regardless of whether the URL was
	// successfully associated with an internal link. This avoids link enumeration.
	jsonResponse(w, http.StatusAccepted, map[string]any{"accepted": true, "reference": id})
}

func formatInt64(value int64) string {
	if value == 0 {
		return "0"
	}
	negative := value < 0
	if negative {
		value = -value
	}
	buf := [20]byte{}
	index := len(buf)
	for value > 0 {
		index--
		buf[index] = byte('0' + value%10)
		value /= 10
	}
	if negative {
		index--
		buf[index] = '-'
	}
	return string(buf[index:])
}
