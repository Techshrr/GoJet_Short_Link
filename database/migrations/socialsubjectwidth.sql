-- Google OpenID Connect `sub` identifiers may be up to 255 characters; preserve provider subjects without truncation.
-- Provider subject identifiers are opaque external keys; do not reduce this width or normalize their stored value.
-- Keep the storage width provider-agnostic so every configured OIDC adapter can preserve its subject verbatim.
ALTER TABLE user_social_identities
    MODIFY provider_subject VARCHAR(255) NOT NULL;

-- Password accounts are usable credentials by default. Social-created users explicitly opt out
-- until a password reset/update changes password_hash; the trigger then marks password login usable.
ALTER TABLE users
    ADD COLUMN password_login_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER password_hash;

CREATE TRIGGER userspasswordcredentialenable
BEFORE UPDATE ON users
FOR EACH ROW
SET NEW.password_login_enabled = IF(NOT (NEW.password_hash <=> OLD.password_hash), TRUE, NEW.password_login_enabled);
