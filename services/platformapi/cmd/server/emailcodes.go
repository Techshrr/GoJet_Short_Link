package main

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

func authCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func (s *server) authPolicy(w http.ResponseWriter, r *http.Request) {
	var mailStatus string
	mailReady := s.db.QueryRowContext(r.Context(), `SELECT status FROM mail_health WHERE singleton_id=1`).Scan(&mailStatus) == nil && mailStatus == "connected"
	jsonResponse(w, http.StatusOK, map[string]any{
		"registration_enabled": s.registrationBool(r.Context(), "registration.enabled", true),
		"registration_code_required": s.registrationBool(r.Context(), "registration.require_email_verification", false) && mailReady,
		"email_code_login_available": mailReady,
	})
}

func (s *server) requestAuthCode(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email string `json:"email"`
		Purpose string `json:"purpose"`
		TurnstileToken string `json:"turnstile_token"`
	}
	if decode(w, r, &in) != nil { return }
	email := strings.ToLower(strings.TrimSpace(in.Email))
	if !strings.Contains(email, "@") || len(email) > 320 || (in.Purpose != "register" && in.Purpose != "login") {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error":"邮箱地址无效"}); return
	}
	surface, action := "login", "login"
	if in.Purpose == "register" { surface, action = "registration", "register" }
	if !s.enforceTurnstile(w, r, surface, action, in.TurnstileToken) { return }
	if in.Purpose == "register" {
		if !s.registrationBool(r.Context(), "registration.enabled", true) { jsonResponse(w, http.StatusForbidden, map[string]string{"error":"当前暂未开放注册"}); return }
		if s.blockedRegistrationEmail(r.Context(), email) { jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error":"该邮箱域名不允许注册"}); return }
		var exists int
		if s.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM users WHERE email=?`, email).Scan(&exists) != nil { jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error":"账户服务暂时不可用"}); return }
		if exists > 0 { jsonResponse(w, http.StatusConflict, map[string]string{"error":"该邮箱已经注册"}); return }
	}
	var mailStatus string
	if s.db.QueryRowContext(r.Context(), `SELECT status FROM mail_health WHERE singleton_id=1`).Scan(&mailStatus) != nil || mailStatus != "connected" { jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error":"邮箱验证码暂时不可用"}); return }
	ip := clientIP(r)
	var recent, seconds int
	_ = s.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM email_auth_codes WHERE created_at>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 15 MINUTE) AND (email=? OR requested_ip=?)`, email, ip).Scan(&recent)
	_ = s.db.QueryRowContext(r.Context(), `SELECT COALESCE(TIMESTAMPDIFF(SECOND,MAX(created_at),UTC_TIMESTAMP()),9999) FROM email_auth_codes WHERE email=? OR requested_ip=?`, email, ip).Scan(&seconds)
	if recent >= 5 || seconds < 60 { jsonResponse(w, http.StatusTooManyRequests, map[string]string{"error":"验证码发送过于频繁，请稍后再试"}); return }
	if in.Purpose == "login" {
		var active int
		_ = s.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM users WHERE email=? AND status='active'`, email).Scan(&active)
		if active == 0 { jsonResponse(w, http.StatusAccepted, map[string]bool{"sent":true}); return }
	}
	code, err := authCode(); if err != nil { jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error":"验证码生成失败"}); return }
	hash, err := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost); if err != nil { jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error":"验证码生成失败"}); return }
	tx, err := s.db.BeginTx(r.Context(), nil); if err != nil { jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error":"验证码服务暂时不可用"}); return }; defer tx.Rollback()
	_, _ = tx.ExecContext(r.Context(), `UPDATE email_auth_codes SET consumed_at=COALESCE(consumed_at,UTC_TIMESTAMP()) WHERE email=? AND purpose=? AND consumed_at IS NULL`, email, in.Purpose)
	if _, err = tx.ExecContext(r.Context(), `INSERT INTO email_auth_codes(email,purpose,code_hash,requested_ip,expires_at) VALUES(?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE))`, email, in.Purpose, string(hash), ip); err != nil { jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error":"验证码服务暂时不可用"}); return }
	if err = tx.Commit(); err != nil { jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error":"验证码服务暂时不可用"}); return }
	actionText := "登录 GoJet"; if in.Purpose == "register" { actionText = "验证邮箱并创建 GoJet 账户" }
	if _, err = s.mail.QueueTemplate(r.Context(), "auth_email_code", email, map[string]string{"site_name":"GoJet","code":code,"action":actionText,"expires_minutes":"10"}); err != nil { jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error":"验证码邮件暂时无法发送"}); return }
	jsonResponse(w, http.StatusAccepted, map[string]int{"expires_in":600})
}

func (s *server) consumeAuthCode(email, purpose, code string) error {
	if len(strings.TrimSpace(code)) != 6 { return errors.New("验证码错误或已过期") }
	tx, err := s.db.Begin(); if err != nil { return err }; defer tx.Rollback()
	var id int64; var hash string; var attempts int
	if err = tx.QueryRow(`SELECT id,code_hash,attempts FROM email_auth_codes WHERE email=? AND purpose=? AND consumed_at IS NULL AND expires_at>UTC_TIMESTAMP() ORDER BY id DESC LIMIT 1 FOR UPDATE`, strings.ToLower(strings.TrimSpace(email)), purpose).Scan(&id,&hash,&attempts); err != nil { return errors.New("验证码错误或已过期") }
	if attempts >= 5 || bcrypt.CompareHashAndPassword([]byte(hash), []byte(strings.TrimSpace(code))) != nil { _, _ = tx.Exec(`UPDATE email_auth_codes SET attempts=attempts+1 WHERE id=?`, id); _ = tx.Commit(); return errors.New("验证码错误或已过期") }
	if _, err = tx.Exec(`UPDATE email_auth_codes SET consumed_at=UTC_TIMESTAMP() WHERE id=?`, id); err != nil { return err }
	return tx.Commit()
}

func (s *server) registerByCode(w http.ResponseWriter, r *http.Request) {
	var in struct { Email string `json:"email"`; Password string `json:"password"`; DisplayName string `json:"display_name"`; EmailCode string `json:"email_code"` }
	if decode(w,r,&in) != nil { return }
	ctx := r.Context(); email := strings.ToLower(strings.TrimSpace(in.Email))
	if !s.registrationBool(ctx,"registration.enabled",true) { jsonResponse(w,http.StatusForbidden,map[string]string{"error":"当前暂未开放注册"}); return }
	if !s.registrationBool(ctx,"registration.require_email_verification",false) { jsonResponse(w,http.StatusConflict,map[string]string{"error":"当前注册不需要邮箱验证码"}); return }
	if s.blockedRegistrationEmail(ctx,email) { jsonResponse(w,http.StatusUnprocessableEntity,map[string]string{"error":"该邮箱域名不允许注册"}); return }
	minPassword := s.registrationInt(ctx,"registration.password_min_length",10,10,72)
	if strings.TrimSpace(in.DisplayName)=="" || len(in.Password)<minPassword { jsonResponse(w,http.StatusUnprocessableEntity,map[string]string{"error":fmt.Sprintf("请填写显示名称，密码至少需要 %d 位",minPassword)}); return }
	if err:=s.consumeAuthCode(email,"register",in.EmailCode); err != nil { jsonResponse(w,http.StatusUnprocessableEntity,map[string]string{"error":err.Error()}); return }
	u, token, err := s.identity.RegisterWithMetadata(ctx,email,in.Password,in.DisplayName,clientIP(r),r.UserAgent()); if err != nil { jsonResponse(w,http.StatusUnprocessableEntity,map[string]string{"error":err.Error()}); return }
	_, err = s.db.ExecContext(ctx, `UPDATE users SET email_verified_at=UTC_TIMESTAMP() WHERE id=?`, u.ID); if err != nil { jsonResponse(w,http.StatusServiceUnavailable,map[string]string{"error":"账户验证状态保存失败"}); return }
	u.EmailVerified=true; jsonResponse(w,http.StatusCreated,map[string]any{"user":u,"token":token,"verification_required":false})
}

func (s *server) loginByCode(w http.ResponseWriter, r *http.Request) {
	var in struct { Email string `json:"email"`; EmailCode string `json:"email_code"` }
	if decode(w,r,&in) != nil { return }
	email:=strings.ToLower(strings.TrimSpace(in.Email)); ip:=clientIP(r)
	if s.loginRateExceeded(r.Context(),email,ip) { jsonResponse(w,http.StatusTooManyRequests,map[string]string{"error":"登录失败次数过多，请稍后再试"}); return }
	if err:=s.consumeAuthCode(email,"login",in.EmailCode); err != nil { s.recordLoginAttempt(r.Context(),email,ip,"failure"); jsonResponse(w,http.StatusUnauthorized,map[string]string{"error":"邮箱或验证码错误"}); return }
	_, _ = s.db.ExecContext(r.Context(), `UPDATE users SET email_verified_at=COALESCE(email_verified_at,UTC_TIMESTAMP()) WHERE email=?`, email)
	u, token, err := s.identity.LoginByEmailWithMetadata(r.Context(),email,ip,r.UserAgent()); if err != nil { s.recordLoginAttempt(r.Context(),email,ip,"failure"); jsonResponse(w,http.StatusUnauthorized,map[string]string{"error":"邮箱或验证码错误"}); return }
	s.recordLoginAttempt(r.Context(),email,ip,"success"); jsonResponse(w,http.StatusOK,map[string]any{"user":u,"token":token})
}
