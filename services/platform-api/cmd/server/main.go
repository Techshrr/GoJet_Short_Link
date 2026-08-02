package main

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"github.com/Techshrr/GoJet_Short_Link/app/domains"
	"github.com/Techshrr/GoJet_Short_Link/app/identity"
	"github.com/Techshrr/GoJet_Short_Link/app/links"
	appmail "github.com/Techshrr/GoJet_Short_Link/app/mail"
	"github.com/Techshrr/GoJet_Short_Link/app/settings"
	"github.com/Techshrr/GoJet_Short_Link/app/workspace"
	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

type server struct {
	db         *sql.DB
	settings   *settings.Store
	mail       *appmail.Service
	identity   *identity.Service
	workspace  *workspace.Service
	links      *links.Service
	domains    *domains.Service
	adminToken string
}

func main() {
	db, err := sql.Open("mysql", required("MYSQL_DSN"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if err = db.Ping(); err != nil {
		log.Fatal(err)
	}
	key, err := settings.DecodeKey(required("SETTINGS_ENCRYPTION_KEY"))
	if err != nil {
		log.Fatal(err)
	}
	store, err := settings.NewStore(db, key)
	if err != nil {
		log.Fatal(err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: getenv("REDIS_ADDRESS", "redis:6379"), Password: os.Getenv("REDIS_PASSWORD")})
	defer rdb.Close()
	if err = rdb.Ping(context.Background()).Err(); err != nil {
		log.Fatal(err)
	}
	workspaceService := workspace.New(db)
	s := &server{db: db, settings: store, mail: appmail.NewService(db, store), identity: identity.New(db), workspace: workspaceService, links: links.New(db, rdb, workspaceService), domains: domains.New(db, workspaceService), adminToken: required("ADMIN_API_TOKEN")}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) { jsonResponse(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("GET /api/public/settings", s.publicSettings)
	mux.HandleFunc("PUT /api/admin/settings/mail", s.admin(s.saveMail))
	mux.HandleFunc("POST /api/admin/mail/test", s.admin(s.testMail))
	mux.HandleFunc("GET /api/admin/mail/logs", s.admin(s.mailLogs))
	mux.HandleFunc("POST /api/admin/mail/{id}/retry", s.admin(s.retryMail))
	mux.HandleFunc("GET /api/admin/settings", s.admin(s.getSettingsCenter))
	mux.HandleFunc("PUT /api/admin/settings/{section}", s.admin(s.saveSettingsSection))
	mux.HandleFunc("POST /api/admin/brand/{asset}", s.admin(s.uploadBrandAsset))
	mux.HandleFunc("DELETE /api/admin/brand/{asset}", s.admin(s.deleteBrandAsset))
	mux.HandleFunc("GET /api/admin/overview", s.admin(s.adminOverview))
	mux.HandleFunc("GET /api/admin/users", s.admin(s.adminUsers))
	mux.HandleFunc("PATCH /api/admin/users/{id}/status", s.admin(s.adminUserStatus))
	mux.HandleFunc("GET /api/admin/workspaces", s.admin(s.adminWorkspaces))
	mux.HandleFunc("GET /api/admin/links", s.admin(s.adminLinks))
	mux.HandleFunc("GET /api/admin/audit", s.admin(s.adminAudit))
	mux.HandleFunc("GET /api/admin/abuse", s.admin(s.adminAbuse))
	mux.HandleFunc("PATCH /api/admin/abuse/{id}", s.admin(s.adminResolveAbuse))
	mux.HandleFunc("GET /api/admin/domains", s.admin(s.adminDomains))
	mux.HandleFunc("GET /api/admin/security", s.admin(s.adminSecurityEvents))
	mux.HandleFunc("PATCH /api/admin/security/{id}", s.admin(s.adminResolveSecurity))
	mux.HandleFunc("GET /api/admin/announcements", s.admin(s.adminAnnouncements))
	mux.HandleFunc("POST /api/admin/announcements", s.admin(s.adminCreateAnnouncement))
	mux.HandleFunc("POST /api/mail/verification", s.user(s.queueVerification))
	mux.HandleFunc("POST /api/auth/verify-email", s.verifyEmail)
	mux.HandleFunc("POST /api/auth/register", s.register)
	mux.HandleFunc("POST /api/auth/login", s.login)
	mux.HandleFunc("GET /api/me", s.user(s.me))
	mux.HandleFunc("POST /api/workspaces", s.user(s.createWorkspace))
	mux.HandleFunc("GET /api/workspaces", s.user(s.listWorkspaces))
	mux.HandleFunc("POST /api/workspaces/{id}/invitations", s.user(s.invite))
	mux.HandleFunc("GET /api/workspaces/{id}/members", s.user(s.workspaceMembers))
	mux.HandleFunc("POST /api/workspaces/{id}/invitations/{invitation}/resend", s.user(s.resendInvite))
	mux.HandleFunc("POST /api/invitations/accept", s.user(s.acceptInvite))
	mux.HandleFunc("POST /api/invitations/reject", s.rejectInvite)
	mux.HandleFunc("DELETE /api/workspaces/{id}/invitations/{invitation}", s.user(s.revokeInvite))
	mux.HandleFunc("PATCH /api/workspaces/{id}/members/{user}", s.user(s.changeMemberRole))
	mux.HandleFunc("DELETE /api/workspaces/{id}/members/{user}", s.user(s.removeMember))
	mux.HandleFunc("GET /api/workspaces/{id}/links", s.user(s.listLinks))
	mux.HandleFunc("POST /api/workspaces/{id}/links", s.user(s.createLink))
	mux.HandleFunc("PATCH /api/workspaces/{id}/links/bulk-status", s.user(s.bulkLinkStatus))
	mux.HandleFunc("GET /api/workspaces/{id}/links/{link}/analytics", s.user(s.linkAnalytics))
	mux.HandleFunc("GET /api/workspaces/{id}/domains", s.user(s.listDomains))
	mux.HandleFunc("POST /api/workspaces/{id}/domains", s.user(s.createDomain))
	mux.HandleFunc("POST /api/workspaces/{id}/domains/{domain}/verify", s.user(s.verifyDomain))
	mux.HandleFunc("POST /api/abuse-reports", s.createAbuseReport)
	address := getenv("PLATFORM_HTTP_ADDRESS", ":8090")
	log.Printf("platform API listening on %s", address)
	log.Fatal((&http.Server{Addr: address, Handler: mux, ReadHeaderTimeout: 5 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second}).ListenAndServe())
}
func (s *server) admin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		provided := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if len(provided) != len(s.adminToken) || subtle.ConstantTimeCompare([]byte(provided), []byte(s.adminToken)) != 1 {
			jsonResponse(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		next(w, r)
	}
}

type mailInput struct {
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	Encryption string `json:"encryption"`
	EHLO       string `json:"ehlo"`
	FromEmail  string `json:"from_email"`
	FromName   string `json:"from_name"`
	ReplyTo    string `json:"reply_to"`
}

func (s *server) saveMail(w http.ResponseWriter, r *http.Request) {
	var in mailInput
	if decode(w, r, &in) != nil {
		return
	}
	config := appmail.SMTPConfig{Host: in.Host, Port: in.Port, Username: in.Username, Password: in.Password, Encryption: in.Encryption, EHLO: in.EHLO, FromEmail: in.FromEmail, FromName: in.FromName, ReplyTo: in.ReplyTo}
	if err := config.Validate(); err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	values := map[string]string{"mail.host": in.Host, "mail.port": strconv.Itoa(in.Port), "mail.username": in.Username, "mail.encryption": in.Encryption, "mail.ehlo": in.EHLO, "mail.from_email": in.FromEmail, "mail.from_name": in.FromName, "mail.reply_to": in.ReplyTo}
	for k, v := range values {
		if err := s.settings.Set(r.Context(), k, v, false); err != nil {
			jsonResponse(w, 503, map[string]string{"error": "settings storage unavailable"})
			return
		}
	}
	if in.Password != "" {
		if err := s.settings.Set(r.Context(), "mail.password", in.Password, true); err != nil {
			jsonResponse(w, 503, map[string]string{"error": "settings storage unavailable"})
			return
		}
	}
	jsonResponse(w, 200, map[string]any{"saved": true, "password": "********"})
}
func (s *server) testMail(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Recipient string `json:"recipient"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if !strings.Contains(in.Recipient, "@") {
		jsonResponse(w, 422, map[string]string{"error": "valid recipient is required"})
		return
	}
	if err := s.mail.Test(r.Context(), in.Recipient, true); err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 200, map[string]bool{"connected": true})
}
func (s *server) queueVerification(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	var status string
	if err := s.db.QueryRowContext(r.Context(), `SELECT status FROM mail_health WHERE singleton_id=1`).Scan(&status); err != nil || status != "connected" {
		jsonResponse(w, 503, map[string]string{"error": "验证邮件暂时无法发送，请稍后重试或联系管理员。"})
		return
	}
	verificationToken, err := s.identity.CreateVerification(r.Context(), user.ID)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "验证邮件暂时无法发送，请稍后重试或联系管理员。"})
		return
	}
	_, err = s.mail.Queue(r.Context(), "verification", user.Email, "验证您的 GoJet 邮箱", "<p>请使用以下令牌完成邮箱验证：</p><p><strong>"+htmlEscape(verificationToken)+"</strong></p>")
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "验证邮件暂时无法发送，请稍后重试或联系管理员。"})
		return
	}
	jsonResponse(w, 202, map[string]bool{"queued": true})
}
func (s *server) mailLogs(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.QueryContext(r.Context(), `SELECT id,message_type,recipient,subject,status,COALESCE(message_id,''),attempts,COALESCE(last_error,''),created_at FROM mail_messages ORDER BY id DESC LIMIT 100`)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "mail logs unavailable"})
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id int64
		var kind, to, subject, status, messageID, lastError string
		var attempts int
		var created time.Time
		if rows.Scan(&id, &kind, &to, &subject, &status, &messageID, &attempts, &lastError, &created) != nil {
			continue
		}
		items = append(items, map[string]any{"id": id, "type": kind, "recipient": to, "subject": subject, "status": status, "message_id": messageID, "attempts": attempts, "last_error": lastError, "created_at": created})
	}
	jsonResponse(w, 200, map[string]any{"data": items})
}
func (s *server) retryMail(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	result, err := s.db.ExecContext(r.Context(), `UPDATE mail_messages SET status='pending',available_at=NOW(),last_error=NULL WHERE id=? AND status='failed'`, id)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "retry unavailable"})
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		jsonResponse(w, 404, map[string]string{"error": "failed message not found"})
		return
	}
	jsonResponse(w, 202, map[string]bool{"queued": true})
}
func (s *server) publicSettings(w http.ResponseWriter, r *http.Request) {
	values, err := s.settings.Public(r.Context())
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "settings unavailable"})
		return
	}
	jsonResponse(w, 200, values)
}
func decode(w http.ResponseWriter, r *http.Request, v any) error {
	err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(v)
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid JSON"})
	}
	return err
}
func jsonResponse(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func htmlEscape(v string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", "\"", "&#34;", "'", "&#39;").Replace(v)
}
func getenv(k, f string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return f
}
func required(k string) string {
	v := os.Getenv(k)
	if v == "" {
		log.Fatalf("%s must be configured", k)
	}
	return v
}

var _ = context.Background
