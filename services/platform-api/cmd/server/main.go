package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"github.com/Techshrr/GoJet_Short_Link/app/adminauth"
	"github.com/Techshrr/GoJet_Short_Link/app/billing"
	"github.com/Techshrr/GoJet_Short_Link/app/domains"
	"github.com/Techshrr/GoJet_Short_Link/app/identity"
	"github.com/Techshrr/GoJet_Short_Link/app/links"
	appmail "github.com/Techshrr/GoJet_Short_Link/app/mail"
	"github.com/Techshrr/GoJet_Short_Link/app/organization"
	appresources "github.com/Techshrr/GoJet_Short_Link/app/resources"
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
	db             *sql.DB
	settings       *settings.Store
	mail           *appmail.Service
	identity       *identity.Service
	workspace      *workspace.Service
	links          *links.Service
	domains        *domains.Service
	redis          *redis.Client
	resources      *appresources.Service
	organizer      *organization.Service
	billing        *billing.Service
	adminAuth      *adminauth.Service
	analyticsGroup string
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
	billingService := billing.New(db)
	workspaceService := workspace.New(db, billingService)
	adminAuth := adminauth.New(db, store)
	if err = adminAuth.Bootstrap(context.Background(), required("ADMIN_BOOTSTRAP_EMAIL"), required("ADMIN_BOOTSTRAP_PASSWORD")); err != nil {
		log.Fatal(err)
	}
	s := &server{db: db, settings: store, mail: appmail.NewService(db, store), identity: identity.New(db), workspace: workspaceService, links: links.New(db, rdb, workspaceService, billingService), domains: domains.New(db, workspaceService), redis: rdb, resources: appresources.New(db, workspaceService, getenv("UPLOAD_STORAGE_PATH", "/data/uploads"), getenv("FILE_STORAGE_PATH", "/data/files"), getenv("PUBLIC_BASE_URL", "http://localhost:8080"), required("QR_TRACKING_KEY")).WithBilling(billingService), organizer: organization.New(db, rdb, workspaceService), billing: billingService, adminAuth: adminAuth, analyticsGroup: getenv("ANALYTICS_GROUP", "gojet-mysql")}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) { jsonResponse(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("GET /api/public/settings", s.publicSettings)
	mux.HandleFunc("GET /api/public/status", s.publicStatus)
	mux.HandleFunc("POST /api/admin/auth/login", s.adminLogin)
	mux.HandleFunc("GET /api/admin/auth/me", s.admin("platform.read", s.adminMe))
	mux.HandleFunc("POST /api/admin/auth/logout", s.admin("platform.read", s.adminLogout))
	mux.HandleFunc("POST /api/admin/auth/totp/begin", s.admin("platform.read", s.adminBeginTOTP))
	mux.HandleFunc("POST /api/admin/auth/totp/confirm", s.admin("platform.read", s.adminConfirmTOTP))
	mux.HandleFunc("POST /api/admin/auth/password", s.admin("platform.read", s.adminChangePassword))
	mux.HandleFunc("DELETE /api/admin/administrators/{id}/sessions", s.admin("admins.manage", s.adminRevokeSessions))
	mux.HandleFunc("GET /api/admin/administrators", s.admin("admins.manage", s.adminListAdministrators))
	mux.HandleFunc("POST /api/admin/administrators", s.admin("admins.manage", s.adminCreateAdministrator))
	mux.HandleFunc("PATCH /api/admin/administrators/{id}", s.admin("admins.manage", s.adminUpdateAdministrator))
	mux.HandleFunc("PUT /api/admin/settings/mail", s.admin("settings.manage", s.saveMail))
	mux.HandleFunc("POST /api/admin/mail/test", s.admin("settings.manage", s.testMail))
	mux.HandleFunc("GET /api/admin/mail/logs", s.admin("settings.manage", s.mailLogs))
	mux.HandleFunc("POST /api/admin/mail/{id}/retry", s.admin("settings.manage", s.retryMail))
	mux.HandleFunc("GET /api/admin/settings", s.admin("settings.manage", s.getSettingsCenter))
	mux.HandleFunc("PUT /api/admin/settings/{section}", s.admin("settings.manage", s.saveSettingsSection))
	mux.HandleFunc("POST /api/admin/brand/{asset}", s.admin("settings.manage", s.uploadBrandAsset))
	mux.HandleFunc("DELETE /api/admin/brand/{asset}", s.admin("settings.manage", s.deleteBrandAsset))
	mux.HandleFunc("GET /api/admin/overview", s.admin("platform.read", s.adminOverview))
	mux.HandleFunc("GET /api/admin/plans", s.admin("settings.manage", s.adminPlans))
	mux.HandleFunc("PUT /api/admin/plans/{id}", s.admin("settings.manage", s.adminUpdatePlan))
	mux.HandleFunc("GET /api/admin/invoices", s.admin("settings.manage", s.adminInvoices))
	mux.HandleFunc("POST /api/admin/invoices/{id}/settle", s.admin("settings.manage", s.adminSettleInvoice))
	mux.HandleFunc("GET /api/admin/users", s.admin("platform.read", s.adminUsers))
	mux.HandleFunc("PATCH /api/admin/users/{id}/status", s.admin("users.manage", s.adminUserStatus))
	mux.HandleFunc("GET /api/admin/workspaces", s.admin("platform.read", s.adminWorkspaces))
	mux.HandleFunc("GET /api/admin/links", s.admin("platform.read", s.adminLinks))
	mux.HandleFunc("GET /api/admin/audit", s.admin("platform.read", s.adminAudit))
	mux.HandleFunc("GET /api/admin/abuse", s.admin("security.manage", s.adminAbuse))
	mux.HandleFunc("PATCH /api/admin/abuse/{id}", s.admin("security.manage", s.adminResolveAbuse))
	mux.HandleFunc("GET /api/admin/domains", s.admin("security.manage", s.adminDomains))
	mux.HandleFunc("GET /api/admin/security", s.admin("security.manage", s.adminSecurityEvents))
	mux.HandleFunc("PATCH /api/admin/security/{id}", s.admin("security.manage", s.adminResolveSecurity))
	mux.HandleFunc("GET /api/admin/announcements", s.admin("content.manage", s.adminAnnouncements))
	mux.HandleFunc("POST /api/admin/announcements", s.admin("content.manage", s.adminCreateAnnouncement))
	mux.HandleFunc("GET /api/admin/files", s.admin("security.manage", s.adminFiles))
	mux.HandleFunc("POST /api/admin/files/{id}/retry-scan", s.admin("security.manage", s.adminRetryFileScan))
	mux.HandleFunc("GET /api/admin/users/{id}/sessions", s.admin("users.manage", s.adminUserSessions))
	mux.HandleFunc("DELETE /api/admin/users/{id}/sessions/{session}", s.admin("users.manage", s.adminRevokeUserSession))
	mux.HandleFunc("GET /api/admin/resources", s.admin("security.manage", s.adminResources))
	mux.HandleFunc("GET /api/admin/resource-inventory", s.admin("security.manage", s.adminResourceInventory))
	mux.HandleFunc("POST /api/admin/resources/{type}/{id}/quarantine", s.admin("security.manage", s.adminQuarantineResource))
	mux.HandleFunc("POST /api/admin/quarantine/{id}/restore", s.admin("security.manage", s.adminRestoreResource))
	mux.HandleFunc("GET /api/admin/diagnostics", s.admin("settings.manage", s.adminDiagnostics))
	mux.HandleFunc("POST /api/admin/diagnostics/reconcile", s.admin("settings.manage", s.adminRunReconciliation))
	mux.HandleFunc("POST /api/admin/diagnostics/cache/flush", s.admin("settings.manage", s.adminFlushCache))
	mux.HandleFunc("PUT /api/admin/diagnostics/maintenance", s.admin("settings.manage", s.adminMaintenance))
	mux.HandleFunc("POST /api/admin/analytics/failures/{id}/requeue", s.admin("settings.manage", s.adminRequeueAnalyticsFailure))
	mux.HandleFunc("POST /api/mail/verification", s.user(s.queueVerification))
	mux.HandleFunc("POST /api/auth/verify-email", s.verifyEmail)
	mux.HandleFunc("POST /api/auth/register", s.register)
	mux.HandleFunc("POST /api/auth/login", s.login)
	mux.HandleFunc("GET /api/me", s.user(s.me))
	mux.HandleFunc("POST /api/workspaces", s.user(s.createWorkspace))
	mux.HandleFunc("GET /api/workspaces", s.user(s.listWorkspaces))
	mux.HandleFunc("GET /api/workspaces/{id}/overview", s.user(s.workspaceOverview))
	mux.HandleFunc("GET /api/workspaces/{id}/billing", s.user(s.workspaceBilling))
	mux.HandleFunc("POST /api/workspaces/{id}/billing/invoices", s.user(s.requestInvoice))
	mux.HandleFunc("PATCH /api/workspaces/{id}/billing/cancellation", s.user(s.cancelSubscription))
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
	mux.HandleFunc("GET /api/workspaces/{id}/links/{link}", s.user(s.getLink))
	mux.HandleFunc("PUT /api/workspaces/{id}/links/{link}", s.user(s.updateLink))
	mux.HandleFunc("GET /api/workspaces/{id}/links/{link}/versions", s.user(s.linkVersions))
	mux.HandleFunc("POST /api/workspaces/{id}/links/{link}/versions/{revision}/restore", s.user(s.restoreLinkVersion))
	mux.HandleFunc("PATCH /api/workspaces/{id}/links/bulk-status", s.user(s.bulkLinkStatus))
	mux.HandleFunc("PATCH /api/workspaces/{id}/links/bulk-move", s.user(s.bulkLinkMove))
	mux.HandleFunc("PATCH /api/workspaces/{id}/links/bulk-tags", s.user(s.bulkLinkTags))
	mux.HandleFunc("DELETE /api/workspaces/{id}/links/bulk", s.user(s.bulkLinkDelete))
	mux.HandleFunc("GET /api/workspaces/{id}/links/export.csv", s.user(s.exportLinksCSV))
	mux.HandleFunc("GET /api/workspaces/{id}/organization", s.user(s.organizationSnapshot))
	mux.HandleFunc("POST /api/workspaces/{id}/campaigns", s.user(s.createCampaign))
	mux.HandleFunc("PATCH /api/workspaces/{id}/campaigns/{campaign}", s.user(s.updateCampaign))
	mux.HandleFunc("POST /api/public/campaigns/{campaign}/conversion", s.recordCampaignConversion)
	mux.HandleFunc("POST /api/workspaces/{id}/folders", s.user(s.createFolder))
	mux.HandleFunc("POST /api/workspaces/{id}/tags", s.user(s.createTag))
	mux.HandleFunc("GET /api/workspaces/{id}/links/{link}/analytics", s.user(s.linkAnalytics))
	mux.HandleFunc("GET /api/workspaces/{id}/domains", s.user(s.listDomains))
	mux.HandleFunc("POST /api/workspaces/{id}/domains", s.user(s.createDomain))
	mux.HandleFunc("POST /api/workspaces/{id}/domains/{domain}/verify", s.user(s.verifyDomain))
	mux.HandleFunc("POST /api/abuse-reports", s.createAbuseReport)
	mux.HandleFunc("POST /api/workspaces/{id}/text-shares", s.user(s.createTextShare))
	mux.HandleFunc("GET /api/workspaces/{id}/text-shares", s.user(s.listTextShares))
	mux.HandleFunc("GET /api/workspaces/{id}/text-shares/{share}", s.user(s.getTextShare))
	mux.HandleFunc("PUT /api/workspaces/{id}/text-shares/{share}", s.user(s.updateTextShare))
	mux.HandleFunc("DELETE /api/workspaces/{id}/text-shares/{share}", s.user(s.deleteTextShare))
	mux.HandleFunc("POST /api/public/text/{slug}", s.readTextShare)
	mux.HandleFunc("GET /t/{slug}", s.publicTextPage)
	mux.HandleFunc("POST /t/{slug}", s.publicTextPage)
	mux.HandleFunc("POST /api/workspaces/{id}/bio-pages", s.user(s.createBioPage))
	mux.HandleFunc("GET /api/workspaces/{id}/bio-pages", s.user(s.listBioPages))
	mux.HandleFunc("PUT /api/workspaces/{id}/bio-pages/{page}", s.user(s.updateBioPage))
	mux.HandleFunc("DELETE /api/workspaces/{id}/bio-pages/{page}", s.user(s.deleteBioPage))
	mux.HandleFunc("GET /api/public/bio/{slug}", s.readBioPage)
	mux.HandleFunc("GET /p/{slug}", s.publicBioPage)
	mux.HandleFunc("POST /api/workspaces/{id}/qr-codes", s.user(s.createQRCode))
	mux.HandleFunc("GET /api/workspaces/{id}/qr-codes", s.user(s.listQRCodes))
	mux.HandleFunc("DELETE /api/workspaces/{id}/qr-codes/{qr}", s.user(s.deleteQRCode))
	mux.HandleFunc("POST /api/workspaces/{id}/file-shares", s.user(s.createFileShare))
	mux.HandleFunc("GET /api/workspaces/{id}/file-shares", s.user(s.listFileShares))
	mux.HandleFunc("GET /api/public/files/{slug}", s.downloadFileShare)
	address := getenv("PLATFORM_HTTP_ADDRESS", ":8090")
	log.Printf("platform API listening on %s", address)
	log.Fatal((&http.Server{Addr: address, Handler: s.maintenance(mux), ReadHeaderTimeout: 5 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second}).ListenAndServe())
}

func (s *server) maintenance(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowed := r.URL.Path == "/health" || r.URL.Path == "/api/public/status" || strings.HasPrefix(r.URL.Path, "/api/admin/")
		if !allowed {
			value, exists, err := s.settings.Get(r.Context(), "system.maintenance_mode")
			if err != nil {
				jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "系统状态暂时无法确认"})
				return
			}
			if exists && value == "true" {
				w.Header().Set("Retry-After", "300")
				jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "GoJet 正在维护，请稍后重试"})
				return
			}
		}
		next.ServeHTTP(w, r)
	})
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
