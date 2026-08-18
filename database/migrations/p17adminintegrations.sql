CREATE TABLE IF NOT EXISTS platform_api_keys (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    token_prefix VARCHAR(20) NOT NULL,
    token_hash BINARY(32) NOT NULL,
    scopes JSON NOT NULL,
    status ENUM('active','revoked') NOT NULL DEFAULT 'active',
    created_by BIGINT UNSIGNED NOT NULL,
    expires_at DATETIME NULL,
    last_used_at DATETIME NULL,
    revoked_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_platform_api_keys_hash (token_hash),
    KEY idx_platform_api_keys_status (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS platform_webhooks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    endpoint_url VARCHAR(2048) NOT NULL,
    events JSON NOT NULL,
    status ENUM('active','disabled') NOT NULL DEFAULT 'active',
    secret_setting_key VARCHAR(190) NOT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    last_delivery_status SMALLINT UNSIGNED NULL,
    last_delivery_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_platform_webhooks_secret_key (secret_setting_key),
    KEY idx_platform_webhooks_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
