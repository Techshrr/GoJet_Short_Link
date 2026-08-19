ALTER TABLE user_social_identities
    MODIFY COLUMN provider_subject VARCHAR(255) NOT NULL;

ALTER TABLE users
    ADD COLUMN password_login_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER password_hash;

-- Password credential state is authoritative in the Go identity service. Social
-- auto-registration explicitly creates password_login_enabled=FALSE, while
-- ChangePassword and ResetPassword explicitly set it TRUE in the same
-- application transaction. Avoid a MySQL trigger here: with binary logging
-- enabled CREATE TRIGGER requires SUPER or a server-global trust switch, which
-- breaks least-privilege fresh installs.
