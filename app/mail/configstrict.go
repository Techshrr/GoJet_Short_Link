package mail

import "context"

// ConfigStrict returns the stored SMTP configuration while preserving read or
// decryption errors. The legacy Config method is intentionally tolerant for
// workers, but the administrator settings UI must never turn a storage error
// into an apparently empty configuration.
func (s *Service) ConfigStrict(ctx context.Context) (SMTPConfig, error) {
	get := func(key string) (string, error) {
		value, _, err := s.settings.Get(ctx, key)
		return value, err
	}
	var cfg SMTPConfig
	var err error
	if cfg.Host, err = get("mail.host"); err != nil { return SMTPConfig{}, err }
	port, err := get("mail.port"); if err != nil { return SMTPConfig{}, err }
	if port != "" {
		for _, ch := range port { if ch < '0' || ch > '9' { return SMTPConfig{}, errInvalidStoredPort{} } }
		for _, ch := range port { cfg.Port = cfg.Port*10 + int(ch-'0') }
	}
	if cfg.Username, err = get("mail.username"); err != nil { return SMTPConfig{}, err }
	if cfg.Password, err = get("mail.password"); err != nil { return SMTPConfig{}, err }
	if cfg.Encryption, err = get("mail.encryption"); err != nil { return SMTPConfig{}, err }
	if cfg.EHLO, err = get("mail.ehlo"); err != nil { return SMTPConfig{}, err }
	if cfg.FromEmail, err = get("mail.from_email"); err != nil { return SMTPConfig{}, err }
	if cfg.FromName, err = get("mail.from_name"); err != nil { return SMTPConfig{}, err }
	if cfg.ReplyTo, err = get("mail.reply_to"); err != nil { return SMTPConfig{}, err }
	return cfg, nil
}

type errInvalidStoredPort struct{}
func (errInvalidStoredPort) Error() string { return "stored SMTP port is invalid" }
