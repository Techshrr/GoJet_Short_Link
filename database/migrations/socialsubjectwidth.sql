-- Google OpenID Connect `sub` identifiers may be up to 255 characters; preserve provider subjects without truncation.
-- Provider subject identifiers are opaque external keys; do not reduce this width or normalize their stored value.
ALTER TABLE user_social_identities
    MODIFY provider_subject VARCHAR(255) NOT NULL;
