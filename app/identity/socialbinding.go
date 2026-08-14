package identity

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

type SocialIdentity struct {
	Provider       string     `json:"provider"`
	ProviderEmail  string     `json:"provider_email"`
	EmailVerified  bool       `json:"email_verified"`
	DisplayName    string     `json:"display_name"`
	AvatarURL      string     `json:"avatar_url"`
	CreatedAt      time.Time  `json:"created_at"`
	LastLoginAt    *time.Time `json:"last_login_at,omitempty"`
}

func (s *Service) PasswordLoginEnabled(ctx context.Context, userID int64) (bool, error) {
	var enabled bool
	if err := s.db.QueryRowContext(ctx, `SELECT password_login_enabled FROM users WHERE id=? AND status='active'`, userID).Scan(&enabled); err != nil {
		return false, err
	}
	return enabled, nil
}

func (s *Service) SocialProviderLinked(ctx context.Context, userID int64, provider string) (bool, error) {
	provider = strings.ToLower(strings.TrimSpace(provider))
	var count int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM user_social_identities WHERE user_id=? AND provider=?`, userID, provider).Scan(&count); err != nil {
		return false, err
	}
	return count > 0, nil
}

func (s *Service) ListSocialIdentities(ctx context.Context, userID int64) ([]SocialIdentity, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT provider,COALESCE(provider_email,''),email_verified,COALESCE(display_name,''),COALESCE(avatar_url,''),created_at,last_login_at FROM user_social_identities WHERE user_id=? ORDER BY provider`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []SocialIdentity{}
	for rows.Next() {
		var item SocialIdentity
		var lastLogin sql.NullTime
		if err := rows.Scan(&item.Provider, &item.ProviderEmail, &item.EmailVerified, &item.DisplayName, &item.AvatarURL, &item.CreatedAt, &lastLogin); err != nil {
			return nil, err
		}
		if lastLogin.Valid {
			value := lastLogin.Time
			item.LastLoginAt = &value
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) BindSocialIdentity(ctx context.Context, userID int64, profile SocialProfile) error {
	profile = normalizeSocialProfile(profile)
	if userID <= 0 || profile.Provider == "" || profile.Subject == "" || len(profile.Subject) > 255 {
		return errors.New("第三方账户身份标识无效")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var status string
	if err = tx.QueryRowContext(ctx, `SELECT status FROM users WHERE id=? FOR UPDATE`, userID).Scan(&status); err != nil || status != "active" {
		return ErrSocialAccountUnavailable
	}

	var subjectOwner int64
	err = tx.QueryRowContext(ctx, `SELECT user_id FROM user_social_identities WHERE provider=? AND provider_subject=? FOR UPDATE`, profile.Provider, profile.Subject).Scan(&subjectOwner)
	if err == nil && subjectOwner != userID {
		return ErrSocialIdentityInUse
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	var identityID int64
	var existingSubject string
	err = tx.QueryRowContext(ctx, `SELECT id,provider_subject FROM user_social_identities WHERE user_id=? AND provider=? FOR UPDATE`, userID, profile.Provider).Scan(&identityID, &existingSubject)
	profileJSON, _ := json.Marshal(map[string]any{"login": profile.Login, "email_verified": profile.EmailVerified})
	if err == nil {
		if existingSubject != profile.Subject {
			return ErrSocialProviderAlreadyLinked
		}
		if _, err = tx.ExecContext(ctx, `UPDATE user_social_identities SET provider_email=COALESCE(?,provider_email),email_verified=IF(?,TRUE,email_verified),display_name=COALESCE(?,display_name),avatar_url=COALESCE(?,avatar_url),profile_json=? WHERE id=?`, socialNullable(profile.Email), profile.EmailVerified, socialNullable(profile.DisplayName), socialNullable(profile.AvatarURL), string(profileJSON), identityID); err != nil {
			return err
		}
	} else if errors.Is(err, sql.ErrNoRows) {
		if _, err = tx.ExecContext(ctx, `INSERT INTO user_social_identities(user_id,provider,provider_subject,provider_email,email_verified,display_name,avatar_url,profile_json) VALUES(?,?,?,?,?,?,?,?)`, userID, profile.Provider, profile.Subject, socialNullable(profile.Email), profile.EmailVerified, socialNullable(profile.DisplayName), socialNullable(profile.AvatarURL), string(profileJSON)); err != nil {
			return err
		}
	} else {
		return err
	}
	metadata, _ := json.Marshal(map[string]any{"provider": profile.Provider, "provider_subject": profile.Subject})
	if _, err = tx.ExecContext(ctx, `INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata) VALUES(?,'auth.social.bind','social_identity',?,?)`, userID, profile.Provider, string(metadata)); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Service) UnbindSocialIdentity(ctx context.Context, userID int64, provider string) error {
	provider = strings.ToLower(strings.TrimSpace(provider))
	if userID <= 0 || provider == "" {
		return ErrSocialIdentityNotLinked
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var status string
	var passwordEnabled bool
	if err = tx.QueryRowContext(ctx, `SELECT status,password_login_enabled FROM users WHERE id=? FOR UPDATE`, userID).Scan(&status, &passwordEnabled); err != nil || status != "active" {
		return ErrSocialAccountUnavailable
	}
	rows, err := tx.QueryContext(ctx, `SELECT id,provider FROM user_social_identities WHERE user_id=? FOR UPDATE`, userID)
	if err != nil {
		return err
	}
	var targetID int64
	count := 0
	for rows.Next() {
		var id int64
		var linkedProvider string
		if err = rows.Scan(&id, &linkedProvider); err != nil {
			rows.Close()
			return err
		}
		count++
		if linkedProvider == provider {
			targetID = id
		}
	}
	if err = rows.Close(); err != nil {
		return err
	}
	if targetID == 0 {
		return ErrSocialIdentityNotLinked
	}
	if !passwordEnabled && count <= 1 {
		return ErrLastLoginCredential
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM user_social_identities WHERE id=? AND user_id=?`, targetID, userID); err != nil {
		return err
	}
	metadata, _ := json.Marshal(map[string]string{"provider": provider})
	if _, err = tx.ExecContext(ctx, `INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata) VALUES(?,'auth.social.unbind','social_identity',?,?)`, userID, provider, string(metadata)); err != nil {
		return err
	}
	return tx.Commit()
}
