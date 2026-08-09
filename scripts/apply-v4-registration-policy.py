#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def replace_function(text,name,new_code):
    marker=f'func (s *server) {name}('
    start=text.find(marker)
    if start<0: raise SystemExit(f'missing function: {name}')
    brace=text.find('{',start); depth=0; end=None; string=False; raw=False; escape=False
    for i in range(brace,len(text)):
        ch=text[i]
        if raw:
            if ch=='`': raw=False
            continue
        if string:
            if escape: escape=False
            elif ch=='\\': escape=True
            elif ch=='"': string=False
            continue
        if ch=='`': raw=True; continue
        if ch=='"': string=True; continue
        if ch=='{': depth+=1
        elif ch=='}':
            depth-=1
            if depth==0: end=i+1; break
    if end is None: raise SystemExit(f'unbalanced function {name}')
    return text[:start]+new_code.strip()+text[end:]

p=ROOT/'services/platform-api/cmd/server/identity.go'; text=p.read_text()
text=replace_function(text,'register',r'''
func (s *server) register(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
	}
	if decode(w, r, &in) != nil { return }
	if !s.registrationBool(r.Context(), "registration.enabled", true) {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "当前未开放注册"}); return
	}
	if s.blockedRegistrationEmail(r.Context(), in.Email) {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "该邮箱域名当前不允许注册"}); return
	}
	minimum := s.registrationInt(r.Context(), "registration.password_min_length", 10, 10, 128)
	if len(in.Password) < minimum {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "密码至少需要 " + strconv.Itoa(minimum) + " 位"}); return
	}
	u, token, err := s.identity.RegisterWithMetadata(r.Context(), in.Email, in.Password, in.DisplayName, requestIP(r), r.UserAgent())
	if err != nil { jsonResponse(w, 422, map[string]string{"error": err.Error()}); return }
	if s.registrationBool(r.Context(), "registration.require_email_verification", false) {
		_ = s.identity.RevokeToken(r.Context(), token)
		queued := false
		verificationToken, createErr := s.identity.CreateVerification(r.Context(), u.ID)
		if createErr == nil {
			base := strings.TrimRight(getenv("PUBLIC_BASE_URL", "http://localhost:8080"), "/")
			verificationURL := base + "/verify-email?token=" + verificationToken
			_, queueErr := s.mail.QueueTemplate(r.Context(), "verification", u.Email, map[string]string{"site_name": "GoJet", "token": verificationToken, "verification_url": verificationURL})
			queued = queueErr == nil
		}
		jsonResponse(w, 201, map[string]any{"user": u, "verification_required": true, "verification_queued": queued}); return
	}
	jsonResponse(w, 201, map[string]any{"user": u, "token": token, "verification_required": false})
}
''')
text=replace_function(text,'login',r'''
func (s *server) login(w http.ResponseWriter, r *http.Request) {
	var in struct { Email string `json:"email"`; Password string `json:"password"` }
	if decode(w, r, &in) != nil { return }
	ip := requestIP(r)
	if s.loginRateExceeded(r.Context(), in.Email, ip) {
		jsonResponse(w, http.StatusTooManyRequests, map[string]string{"error": "登录尝试过于频繁，请 15 分钟后重试"}); return
	}
	u, token, err := s.identity.LoginWithMetadata(r.Context(), in.Email, in.Password, ip, r.UserAgent())
	if err != nil {
		s.recordLoginAttempt(r.Context(), in.Email, ip, "failure")
		jsonResponse(w, 401, map[string]string{"error": "邮箱或密码错误"}); return
	}
	s.recordLoginAttempt(r.Context(), in.Email, ip, "success")
	if s.registrationBool(r.Context(), "registration.require_email_verification", false) && !u.EmailVerified {
		_ = s.identity.RevokeToken(r.Context(), token)
		queued := false
		var recent int
		_ = s.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM email_verification_tokens WHERE user_id=? AND used_at IS NULL AND created_at>DATE_SUB(NOW(),INTERVAL 2 MINUTE)`, u.ID).Scan(&recent)
		if recent == 0 {
			verificationToken, createErr := s.identity.CreateVerification(r.Context(), u.ID)
			if createErr == nil {
				base := strings.TrimRight(getenv("PUBLIC_BASE_URL", "http://localhost:8080"), "/")
				verificationURL := base + "/verify-email?token=" + verificationToken
				_, queueErr := s.mail.QueueTemplate(r.Context(), "verification", u.Email, map[string]string{"site_name": "GoJet", "token": verificationToken, "verification_url": verificationURL})
				queued = queueErr == nil
			}
		}
		jsonResponse(w, 403, map[string]any{"error": "请先完成邮箱验证", "email_verification_required": true, "verification_queued": queued}); return
	}
	jsonResponse(w, 200, map[string]any{"user": u, "token": token})
}
''')
text=replace_function(text,'requestPasswordReset',r'''
func (s *server) requestPasswordReset(w http.ResponseWriter, r *http.Request) {
	var in struct { Email string `json:"email"` }
	if decode(w, r, &in) != nil { return }
	if !s.registrationBool(r.Context(), "registration.forgot_password", true) {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "当前已关闭找回密码功能"}); return
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))
	// Do not disclose whether an account exists.
	if strings.Contains(email, "@") {
		var id int64; var storedEmail string
		if err := s.db.QueryRowContext(r.Context(), `SELECT id,email FROM users WHERE email=? AND status='active'`, email).Scan(&id, &storedEmail); err == nil {
			if resetToken, createErr := s.identity.CreatePasswordReset(r.Context(), id, nil); createErr == nil {
				base := strings.TrimRight(getenv("PUBLIC_BASE_URL", "http://localhost:8080"), "/")
				resetURL := base + "/reset-password?token=" + resetToken
				_, _ = s.mail.QueueTemplate(r.Context(), "password_reset", storedEmail, map[string]string{"site_name": "GoJet", "reset_url": resetURL})
			}
		}
	}
	jsonResponse(w, 202, map[string]bool{"queued": true})
}
''')
text=replace_function(text,'resetPassword',r'''
func (s *server) resetPassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if decode(w, r, &in) != nil { return }
	minimum := s.registrationInt(r.Context(), "registration.password_min_length", 10, 10, 128)
	if len(in.Password) < minimum {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "新密码至少需要 " + strconv.Itoa(minimum) + " 位"}); return
	}
	if err := s.identity.ResetPassword(r.Context(), in.Token, in.Password); err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()}); return
	}
	jsonResponse(w, 200, map[string]bool{"reset": true})
}
''')
p.write_text(text)

# Remove settings that do not yet have a complete product flow from the formal UI.
settings=ROOT/'frontend/admin-console/settings-full.js'; text=settings.read_text()
for fragment in [
    "      checkbox('registration.invitation_only','仅邀请注册',bool(val(reg,'registration.invitation_only',false)))+\n",
    "      checkbox('registration.admin_mfa','允许管理员登录 MFA',bool(val(reg,'registration.admin_mfa',true)),'MFA 只用于管理员登录，不用于后台每次保存。')+\n",
    "      input('turnstile.site_key','Turnstile Site Key',val(reg,'turnstile.site_key'))+\n",
    "      `<label><span>Turnstile Secret</span><input name=\"turnstile.secret\" type=\"password\" value=\"\" placeholder=\"${val(reg,'turnstile.secret')?'已配置；留空保持不变':'尚未配置'}\"></label>`\n"
]:
    text=text.replace(fragment,'')
settings.write_text(text)

# Release and validation gates explicitly require the real login policy table.
verify=ROOT/'scripts/verify-release.sh'; text=verify.read_text()
text=text.replace('database/migrations/025_mail_templates.sql', 'database/migrations/025_mail_templates.sql database/migrations/027_user_login_security.sql')
if 'user_login_attempts' not in text:
    text=text.replace("grep -Fq '{{verification_url}}' \"$ROOT/database/migrations/025_mail_templates.sql\" || { echo 'verification mail link is missing' >&2; exit 1; }", "grep -Fq '{{verification_url}}' \"$ROOT/database/migrations/025_mail_templates.sql\" || { echo 'verification mail link is missing' >&2; exit 1; }\ngrep -Fq 'CREATE TABLE user_login_attempts' \"$ROOT/database/migrations/027_user_login_security.sql\" || { echo 'user login rate-limit schema is missing' >&2; exit 1; }")
verify.write_text(text)

workflow=ROOT/'.github/workflows/installer-release.yml'; text=workflow.read_text()
if "grep -Fq 'loginRateExceeded' services/platform-api/cmd/server/identity.go" not in text:
    text=text.replace("grep -Fq 'POST /api/auth/forgot-password' services/platform-api/cmd/server/main.go", "grep -Fq 'POST /api/auth/forgot-password' services/platform-api/cmd/server/main.go\n          grep -Fq 'loginRateExceeded' services/platform-api/cmd/server/identity.go\n          grep -Fq 'blockedRegistrationEmail' services/platform-api/cmd/server/identity.go\n          grep -Fq 'CREATE TABLE user_login_attempts' database/migrations/027_user_login_security.sql")
workflow.write_text(text)
print('V4 registration policy converged')
