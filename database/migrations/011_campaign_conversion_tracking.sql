ALTER TABLE campaigns
    ADD COLUMN conversion_token_hash CHAR(64) NULL AFTER conversion_count;

UPDATE campaigns SET conversion_token_hash=SHA2(CONCAT(UUID(),':',id,':',created_at),256) WHERE conversion_token_hash IS NULL;

ALTER TABLE campaigns
    MODIFY conversion_token_hash CHAR(64) NOT NULL,
    ADD UNIQUE KEY campaigns_conversion_token_unique(conversion_token_hash);
