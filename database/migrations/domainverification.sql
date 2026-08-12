ALTER TABLE custom_domains ADD COLUMN verification_token_hash CHAR(64) NOT NULL AFTER hostname;
