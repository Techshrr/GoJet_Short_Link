#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def replace_function(text,name,new_code):
    marker=f'func (s *server) {name}('
    start=text.find(marker)
    if start<0:
        raise SystemExit(f'missing function: {name}')
    brace=text.find('{',start)
    if brace<0:
        raise SystemExit(f'missing function brace: {name}')
    depth=0
    end=None
    in_string=False
    raw_string=False
    escape=False
    for i in range(brace,len(text)):
        ch=text[i]
        if raw_string:
            if ch=='`': raw_string=False
            continue
        if in_string:
            if escape: escape=False
            elif ch=='\\': escape=True
            elif ch=='"': in_string=False
            continue
        if ch=='`': raw_string=True; continue
        if ch=='"': in_string=True; continue
        if ch=='{': depth+=1
        elif ch=='}':
            depth-=1
            if depth==0:
                end=i+1
                break
    if end is None:
        raise SystemExit(f'unbalanced function: {name}')
    return text[:start]+new_code.strip()+text[end:]

identity=ROOT/'services/platform-api/cmd/server/identity.go'
text=identity.read_text()
register=r'''
func (s *server) register(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if enabled, exists, _ := s.settings.Get(r.Context(), "registration.enabled"); exists && enabled == "false" {
		jsonResponse(w, 403, map[string]string{"error": "当前未开放注册"})
		return
	}
	u, token, err := s.identity.RegisterWithMetadata(r.Context(), in.Email, in.Password, in.DisplayName, requestIP(r), r.UserAgent())
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	requireVerification := false
	if required, exists, _ := s.settings.Get(r.Context(), "registration.require_email_verification"); exists && required == "true" {
		requireVerification = true
	}
	if requireVerification {
		// RegistrationWithMetadata creates a normal session. A user that still
		// needs email verification must never keep a usable orphan session.
		_ = s.identity.RevokeToken(r.Context(), token)
		queued := false
		verificationToken, createErr := s.identity.CreateVerification(r.Context(), u.ID)
		if createErr == nil {
			base := strings.TrimRight(getenv("PUBLIC_BASE_URL", "http://localhost:8080"), "/")
			verificationURL := base + "/verify-email?token=" + verificationToken
			_, queueErr := s.mail.QueueTemplate(r.Context(), "verification", u.Email, map[string]string{"site_name": "GoJet", "token": verificationToken, "verification_url": verificationURL})
			queued = queueErr == nil
		}
		jsonResponse(w, 201, map[string]any{"user": u, "verification_required": true, "verification_queued": queued})
		return
	}
	jsonResponse(w, 201, map[string]any{"user": u, "token": token, "verification_required": false})
}
'''
login=r'''
func (s *server) login(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	u, token, err := s.identity.LoginWithMetadata(r.Context(), in.Email, in.Password, requestIP(r), r.UserAgent())
	if err != nil {
		jsonResponse(w, 401, map[string]string{"error": "邮箱或密码错误"})
		return
	}
	if required, exists, _ := s.settings.Get(r.Context(), "registration.require_email_verification"); exists && required == "true" && !u.EmailVerified {
		// Do not leave behind a session that the user never receives.
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
		jsonResponse(w, 403, map[string]any{"error": "请先完成邮箱验证", "email_verification_required": true, "verification_queued": queued})
		return
	}
	jsonResponse(w, 200, map[string]any{"user": u, "token": token})
}
'''
text=replace_function(text,'register',register)
text=replace_function(text,'login',login)

if 'func (s *server) requestPasswordReset(' not in text:
    marker='func (s *server) resetPassword('
    pos=text.find(marker)
    if pos<0: raise SystemExit('missing resetPassword')
    forgot=r'''
func (s *server) requestPasswordReset(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email string `json:"email"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))
	// Always return the same response so this endpoint cannot be used for
	// account enumeration.
	if strings.Contains(email, "@") {
		var id int64
		var storedEmail string
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

'''
    text=text[:pos]+forgot+text[pos:]
identity.write_text(text)

main=ROOT/'services/platform-api/cmd/server/main.go'
text=main.read_text()
old='mux.HandleFunc("POST /api/auth/forgot-password", s.resetPassword)'
new='mux.HandleFunc("POST /api/auth/forgot-password", s.requestPasswordReset)'
if old in text:
    text=text.replace(old,new,1)
elif new not in text:
    raise SystemExit('forgot-password route pattern not found')
main.write_text(text)

admin=ROOT/'app/adminauth/service.go'
text=admin.read_text()
needle='''\tif len(requested) == 0 && role != "custom" {\n\t\trequested = roleTemplates[role]\n\t}\n'''
insert='''\tif len(requested) == 0 && role != "custom" {\n\t\trequested = roleTemplates[role]\n\t}\n\t// Every active administrator needs the self-service/admin-shell baseline.\n\t// This does not grant management powers; it only prevents a custom role\n\t// from being unable to restore its own authenticated admin session.\n\trequested = append(requested, "platform.read")\n'''
if needle in text and 'Every active administrator needs the self-service/admin-shell baseline' not in text:
    text=text.replace(needle,insert,1)
elif 'Every active administrator needs the self-service/admin-shell baseline' not in text:
    raise SystemExit('normalizePermissions insertion point not found')
admin.write_text(text)

print('V4 auth fixes applied')
