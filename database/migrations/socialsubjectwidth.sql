-- Google OpenID Connect `sub` identifiers may be up to 255 characters; preserve provider subjects without truncation.
ALTER TABLE user_social_identities
    MODIFY provider_subject VARCHAR(255) NOT NULL;
