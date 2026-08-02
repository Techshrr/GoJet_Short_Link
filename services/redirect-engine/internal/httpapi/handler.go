package httpapi

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"golang.org/x/crypto/bcrypt"
	"html/template"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/services/redirect-engine/internal/domain"
	"github.com/Techshrr/GoJet_Short_Link/services/redirect-engine/internal/store"
)

type Handler struct {
	store   store.Store
	hashKey string
	qrKey   string
}

func New(s store.Store, hashKey string, qrKey ...string) http.Handler {
	trackingKey := hashKey
	if len(qrKey) > 0 {
		trackingKey = qrKey[0]
	}
	h := &Handler{store: s, hashKey: hashKey, qrKey: trackingKey}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", h.health)
	mux.HandleFunc("POST /api/links", h.create)
	mux.HandleFunc("GET /api/links/{id}/stats", h.stats)
	mux.HandleFunc("GET /api/system/analytics", h.analytics)
	mux.HandleFunc("GET /{code}", h.redirect)
	mux.HandleFunc("POST /{code}/unlock", h.unlock)
	return mux
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var l domain.Link
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&l) != nil || l.ID == "" || l.Code == "" {
		writeJSON(w, 400, map[string]string{"error": "id and code are required"})
		return
	}
	u, err := url.ParseRequestURI(l.Destination)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		writeJSON(w, 400, map[string]string{"error": "destination must be an absolute HTTP(S) URL"})
		return
	}
	if l.StatusCode == 0 {
		l.StatusCode = http.StatusFound
	}
	if l.StatusCode != 301 && l.StatusCode != 302 && l.StatusCode != 307 && l.StatusCode != 308 {
		writeJSON(w, 400, map[string]string{"error": "unsupported redirect status"})
		return
	}
	for _, rule := range l.RoutingRules {
		if !map[string]bool{"device": true, "country": true, "language": true, "source": true}[rule.Dimension] || rule.Value == "" || !safeDestination(rule.Destination) {
			writeJSON(w, 400, map[string]string{"error": "routing rules require a supported dimension, value and safe destination"})
			return
		}
	}
	weight, ids := 0, map[string]bool{}
	for _, item := range l.Destinations {
		if item.ID == "" || ids[item.ID] || item.Weight < 1 || !safeDestination(item.Destination) {
			writeJSON(w, 400, map[string]string{"error": "A/B destinations require unique ids, positive weights and safe destinations"})
			return
		}
		ids[item.ID], weight = true, weight+item.Weight
	}
	if len(l.Destinations) > 0 && (len(l.Destinations) < 2 || weight != 100) {
		writeJSON(w, 400, map[string]string{"error": "A/B destination weights must total 100"})
		return
	}
	l.Active = true
	if err := h.store.SaveLink(r.Context(), l); err != nil {
		writeJSON(w, 503, map[string]string{"error": "link storage is temporarily unavailable"})
		return
	}
	writeJSON(w, 201, l)
}

func safeDestination(value string) bool {
	u, err := url.ParseRequestURI(value)
	return err == nil && u.Host != "" && (u.Scheme == "http" || u.Scheme == "https")
}
func (h *Handler) stats(w http.ResponseWriter, r *http.Request) {
	s, err := h.store.Stats(r.Context(), r.PathValue("id"))
	if err != nil {
		writeJSON(w, 503, map[string]string{"error": "analytics temporarily unavailable"})
		return
	}
	writeJSON(w, 200, s)
}
func (h *Handler) analytics(w http.ResponseWriter, r *http.Request) {
	n, err := h.store.Backlog(r.Context())
	if err != nil {
		writeJSON(w, 503, map[string]string{"error": "analytics queue unavailable"})
		return
	}
	writeJSON(w, 200, map[string]int64{"stream_backlog": n})
}
func (h *Handler) redirect(w http.ResponseWriter, r *http.Request) {
	host, _, splitErr := net.SplitHostPort(r.Host)
	if splitErr != nil {
		host = r.Host
	}
	l, err := h.store.FindLink(r.Context(), strings.ToLower(host), r.PathValue("code"))
	if errors.Is(err, store.ErrNotFound) || !l.Active {
		writeJSON(w, 404, map[string]string{"error": "short link not found"})
		return
	}
	if err != nil {
		writeJSON(w, 503, map[string]string{"error": "redirect service temporarily unavailable"})
		return
	}
	if l.ExpiresAt != nil && !l.ExpiresAt.After(time.Now()) {
		writeJSON(w, http.StatusGone, map[string]string{"error": "short link has expired"})
		return
	}
	if l.PasswordHash != "" && !h.unlocked(r, l) {
		h.passwordPage(w, l.Code, "")
		return
	}
	destination, destinationID := h.destination(r, l)
	v := h.visit(r, l, destinationID, destination)
	if err := h.store.RecordVisit(r.Context(), v); err != nil {
		if errors.Is(err, store.ErrRateLimited) {
			w.Header().Set("Retry-After", "60")
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "too many visits; please retry shortly"})
			return
		}
		if errors.Is(err, store.ErrExhausted) {
			writeJSON(w, http.StatusGone, map[string]string{"error": "short link visit limit reached"})
			return
		}
		writeJSON(w, 503, map[string]string{"error": "visit could not be recorded; please retry"})
		return
	}
	http.Redirect(w, r, destination, l.StatusCode)
}

func (h *Handler) unlock(w http.ResponseWriter, r *http.Request) {
	host, _, splitErr := net.SplitHostPort(r.Host)
	if splitErr != nil {
		host = r.Host
	}
	l, err := h.store.FindLink(r.Context(), strings.ToLower(host), r.PathValue("code"))
	if err != nil || !l.Active {
		writeJSON(w, 404, map[string]string{"error": "short link not found"})
		return
	}
	if err = r.ParseForm(); err != nil || bcrypt.CompareHashAndPassword([]byte(l.PasswordHash), []byte(r.FormValue("password"))) != nil {
		h.passwordPage(w, l.Code, "密码错误，请重试。")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "gojet_unlock_" + l.Code, Value: h.unlockSignature(l), Path: "/" + l.Code, HttpOnly: true, Secure: r.Header.Get("X-Forwarded-Proto") == "https" || r.TLS != nil, SameSite: http.SameSiteLaxMode, MaxAge: 3600})
	http.Redirect(w, r, "/"+l.Code, http.StatusSeeOther)
}
func (h *Handler) unlocked(r *http.Request, l domain.Link) bool {
	cookie, err := r.Cookie("gojet_unlock_" + l.Code)
	return err == nil && hmac.Equal([]byte(cookie.Value), []byte(h.unlockSignature(l)))
}
func (h *Handler) unlockSignature(l domain.Link) string {
	mac := hmac.New(sha256.New, []byte(h.hashKey))
	_, _ = mac.Write([]byte(l.Code + "|" + l.PasswordHash))
	return hex.EncodeToString(mac.Sum(nil))
}

var passwordTemplate = template.Must(template.New("password").Parse(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>受保护的 GoJet 链接</title><style>body{margin:0;background:#f4f8fc;color:#10233f;font:15px system-ui;min-height:100vh;display:grid;place-items:center}form{width:min(390px,calc(100% - 32px));background:#fff;border:1px solid #dce6ef;border-radius:12px;padding:32px;box-sizing:border-box}h1{font-size:24px}input,button{width:100%;height:42px;box-sizing:border-box;margin-top:12px;border:1px solid #c9d6e2;border-radius:7px;padding:0 10px}button{background:#1769e0;color:white;font-weight:700}.error{color:#b42318}</style></head><body><form method="post" action="/{{.Code}}/unlock"><b>GoJet.</b><h1>此链接受密码保护</h1><p>输入访问密码后继续前往目标页面。</p><input name="password" type="password" required autofocus autocomplete="current-password"><button>验证并继续</button>{{if .Error}}<p class="error">{{.Error}}</p>{{end}}</form></body></html>`))

func (h *Handler) passwordPage(w http.ResponseWriter, code, message string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusUnauthorized)
	_ = passwordTemplate.Execute(w, map[string]string{"Code": code, "Error": message})
}

func (h *Handler) destination(r *http.Request, l domain.Link) (string, string) {
	target, destinationID := l.Destination, l.ID
	ua := strings.ToLower(r.UserAgent())
	device := "desktop"
	if strings.Contains(ua, "mobile") {
		device = "mobile"
	} else if strings.Contains(ua, "tablet") || strings.Contains(ua, "ipad") {
		device = "tablet"
	}
	language := strings.ToLower(strings.TrimSpace(strings.Split(r.Header.Get("Accept-Language"), ",")[0]))
	country := strings.ToLower(r.Header.Get("CF-IPCountry"))
	source := "direct"
	if r.Referer() != "" {
		source = "unknown"
		if u, err := url.Parse(r.Referer()); err == nil && u.Hostname() != "" {
			source = strings.ToLower(u.Hostname())
		}
	}
	values := map[string]string{"device": device, "country": country, "language": language, "source": source}
	for i, rule := range l.RoutingRules {
		actual, ok := values[rule.Dimension]
		want := strings.ToLower(strings.TrimSpace(rule.Value))
		if ok && (actual == want || (rule.Dimension == "language" && strings.HasPrefix(actual, want+"-"))) {
			target, destinationID = rule.Destination, "rule-"+strconv.Itoa(i+1)
			break
		}
	}
	if target == l.Destination && len(l.Destinations) > 0 {
		total := 0
		for _, item := range l.Destinations {
			if item.Weight > 0 {
				total += item.Weight
			}
		}
		if total > 0 {
			ip := clientIP(r)
			sum := sha256.Sum256([]byte(h.hashKey + "|ab|" + l.ID + "|" + ip + "|" + r.UserAgent()))
			bucket := ((int(sum[0]) << 8) | int(sum[1])) % total
			for i, item := range l.Destinations {
				if item.Weight <= 0 {
					continue
				}
				if bucket < item.Weight {
					target, destinationID = item.Destination, item.ID
					if destinationID == "" {
						destinationID = "variant-" + strconv.Itoa(i+1)
					}
					break
				}
				bucket -= item.Weight
			}
		}
	}
	if parsed, err := url.Parse(target); err == nil {
		query := parsed.Query()
		for key, value := range l.UTM {
			if strings.HasPrefix(key, "utm_") && value != "" && query.Get(key) == "" {
				query.Set(key, value)
			}
		}
		parsed.RawQuery = query.Encode()
		target = parsed.String()
	}
	return target, destinationID
}

func (h *Handler) visit(r *http.Request, l domain.Link, destinationID, destination string) domain.Visit {
	ua := strings.ToLower(r.UserAgent())
	bot := strings.Contains(ua, "bot") || strings.Contains(ua, "crawler") || strings.Contains(ua, "spider")
	device := "desktop"
	if strings.Contains(ua, "mobile") {
		device = "mobile"
	}
	browser := "other"
	switch {
	case strings.Contains(ua, "edg/"):
		browser = "edge"
	case strings.Contains(ua, "chrome/"):
		browser = "chrome"
	case strings.Contains(ua, "firefox/"):
		browser = "firefox"
	case strings.Contains(ua, "safari/"):
		browser = "safari"
	}
	os := "other"
	switch {
	case strings.Contains(ua, "windows"):
		os = "windows"
	case strings.Contains(ua, "android"):
		os = "android"
	case strings.Contains(ua, "iphone") || strings.Contains(ua, "ipad"):
		os = "ios"
	case strings.Contains(ua, "mac os"):
		os = "macos"
	case strings.Contains(ua, "linux"):
		os = "linux"
	}
	refURL, refHost, source := r.Referer(), "", "direct"
	if refURL != "" {
		source = "unknown"
		if u, e := url.Parse(refURL); e == nil && u.Hostname() != "" {
			refHost = u.Hostname()
			source = "referer"
		}
	}
	ip := clientIP(r)
	sum := sha256.Sum256([]byte(h.hashKey + "|" + ip + "|" + r.UserAgent()))
	q := r.URL.Query()
	if parsed, err := url.Parse(destination); err == nil {
		for _, key := range []string{"utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"} {
			if value := parsed.Query().Get(key); value != "" {
				q.Set(key, value)
			}
		}
	}
	lang := strings.TrimSpace(strings.Split(r.Header.Get("Accept-Language"), ",")[0])
	visitType := "redirect"
	mac := hmac.New(sha256.New, []byte(h.qrKey))
	_, _ = mac.Write([]byte(l.ID + "|" + l.Domain + "|" + l.Code))
	provided, signatureErr := hex.DecodeString(q.Get("_gojet_qr"))
	if signatureErr == nil && hmac.Equal(provided, mac.Sum(nil)) {
		visitType = "qr"
	}
	return domain.Visit{LinkID: l.ID, DestinationID: destinationID, Timestamp: time.Now(), VisitorHash: hex.EncodeToString(sum[:]), RefererURL: refURL, RefererHost: refHost, SourceType: source, Country: r.Header.Get("CF-IPCountry"), Region: r.Header.Get("X-GoJet-Region"), City: r.Header.Get("X-GoJet-City"), Device: device, Browser: browser, OS: os, Language: lang, UTMSource: q.Get("utm_source"), UTMMedium: q.Get("utm_medium"), UTMCampaign: q.Get("utm_campaign"), UTMContent: q.Get("utm_content"), UTMTerm: q.Get("utm_term"), VisitType: visitType, IsBot: bot, MaxClicks: l.MaxClicks, OneTime: l.OneTime}
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	peer := net.ParseIP(host)
	if peer != nil && (peer.IsPrivate() || peer.IsLoopback()) {
		if forwarded := net.ParseIP(strings.TrimSpace(r.Header.Get("X-Real-IP"))); forwarded != nil {
			return forwarded.String()
		}
	}
	return host
}
