package settings

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
)

type Store struct {
	db  *sql.DB
	key []byte
}

func NewStore(db *sql.DB, key []byte) (*Store, error) {
	if len(key) != 32 {
		return nil, errors.New("SETTINGS_ENCRYPTION_KEY must decode to exactly 32 bytes")
	}
	return &Store{db: db, key: key}, nil
}
func DecodeKey(value string) ([]byte, error) { return base64.StdEncoding.DecodeString(value) }
func (s *Store) Set(ctx context.Context, key, value string, sensitive bool) error {
	if sensitive {
		encrypted, err := s.encrypt([]byte(value))
		if err != nil {
			return err
		}
		value = encrypted
	}
	_, err := s.db.ExecContext(ctx, `INSERT INTO system_settings(setting_key,setting_value,is_encrypted) VALUES(?,?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),is_encrypted=VALUES(is_encrypted)`, key, value, sensitive)
	return err
}
func (s *Store) Get(ctx context.Context, key string) (string, bool, error) {
	var value string
	var encrypted bool
	err := s.db.QueryRowContext(ctx, `SELECT setting_value,is_encrypted FROM system_settings WHERE setting_key=?`, key).Scan(&value, &encrypted)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	if encrypted {
		plain, err := s.decrypt(value)
		if err != nil {
			return "", false, err
		}
		value = string(plain)
	}
	return value, true, nil
}
func (s *Store) Public(ctx context.Context) (map[string]any, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT setting_key,setting_value FROM system_settings WHERE is_encrypted=FALSE AND setting_key IN ('site.name','site.short_name','site.tagline','site.description','site.language','site.timezone','site.contact_email','site.support_email','site.company_name','site.company_address','site.copyright','brand.primary_color','brand.logo_url','brand.logo_dark_url','brand.logo_light_url','brand.logo_square_url','brand.favicon_url','brand.apple_touch_icon_url','brand.pwa_icon_url','brand.share_image_url','brand.login_image_url','brand.mail_logo_url','seo.default_title','seo.title_template','seo.meta_description','seo.meta_keywords','seo.canonical_url','seo.open_graph','seo.twitter_card','seo.robots','seo.sitemap','seo.verification')`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]any{}
	for rows.Next() {
		var k, v string
		if err = rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		var decoded any
		if json.Unmarshal([]byte(v), &decoded) == nil {
			out[k] = decoded
		} else {
			out[k] = v
		}
	}
	return out, rows.Err()
}
func (s *Store) encrypt(plain []byte) (string, error) {
	block, err := aes.NewCipher(s.key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(gcm.Seal(nonce, nonce, plain, nil)), nil
}
func (s *Store) decrypt(value string) ([]byte, error) {
	data, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(s.key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(data) < gcm.NonceSize() {
		return nil, errors.New("encrypted setting is truncated")
	}
	return gcm.Open(nil, data[:gcm.NonceSize()], data[gcm.NonceSize():], nil)
}
