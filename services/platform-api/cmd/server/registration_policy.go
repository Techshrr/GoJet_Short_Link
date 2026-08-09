package main

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"
)

func (s *server) registrationBool(ctx context.Context, key string, fallback bool) bool {
	raw, exists, err := s.settings.Get(ctx, key)
	if err != nil || !exists {
		return fallback
	}
	var value bool
	if json.Unmarshal([]byte(raw), &value) == nil {
		return value
	}
	return strings.EqualFold(strings.TrimSpace(raw), "true")
}

func (s *server) registrationInt(ctx context.Context, key string, fallback, min, max int) int {
	raw, exists, err := s.settings.Get(ctx, key)
	if err != nil || !exists {
		return fallback
	}
	var value int
	if json.Unmarshal([]byte(raw), &value) != nil {
		value, err = strconv.Atoi(strings.Trim(strings.TrimSpace(raw), `"`))
		if err != nil {
			return fallback
		}
	}
	if value < min || value > max {
		return fallback
	}
	return value
}

func (s *server) registrationString(ctx context.Context, key string) string {
	raw, exists, err := s.settings.Get(ctx, key)
	if err != nil || !exists {
		return ""
	}
	var value string
	if json.Unmarshal([]byte(raw), &value) == nil {
		return value
	}
	return strings.TrimSpace(raw)
}

func (s *server) blockedRegistrationEmail(ctx context.Context, email string) bool {
	parts := strings.Split(strings.ToLower(strings.TrimSpace(email)), "@")
	if len(parts) != 2 || parts[1] == "" {
		return false
	}
	domain := parts[1]
	configured := s.registrationString(ctx, "registration.blocked_domains")
	configured = strings.NewReplacer("\r", "\n", ",", "\n", ";", "\n").Replace(strings.ToLower(configured))
	for _, item := range strings.Fields(configured) {
		item = strings.TrimSpace(strings.TrimPrefix(item, "@"))
		if item == "" {
			continue
		}
		if domain == item || strings.HasSuffix(domain, "."+item) {
			return true
		}
	}
	return false
}

func (s *server) loginRateExceeded(ctx context.Context, email, ip string) bool {
	limit := s.registrationInt(ctx, "registration.login_rate_limit", 10, 1, 100)
	var failures int
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM user_login_attempts WHERE outcome='failure' AND created_at>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 15 MINUTE) AND (ip_address=? OR email=?)`, ip, strings.ToLower(strings.TrimSpace(email))).Scan(&failures)
	return err == nil && failures >= limit
}

func (s *server) recordLoginAttempt(ctx context.Context, email, ip, outcome string) {
	if outcome != "success" && outcome != "failure" {
		return
	}
	_, _ = s.db.ExecContext(ctx, `INSERT INTO user_login_attempts(email,ip_address,outcome) VALUES(?,?,?)`, strings.ToLower(strings.TrimSpace(email)), ip, outcome)
}
