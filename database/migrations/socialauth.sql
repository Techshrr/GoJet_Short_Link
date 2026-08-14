CREATE TABLE user_social_identities (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    provider VARCHAR(32) NOT NULL,
    provider_subject VARCHAR(191) NOT NULL,
    provider_email VARCHAR(320) NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    display_name VARCHAR(120) NULL,
    avatar_url VARCHAR(1024) NULL,
    profile_json JSON NULL,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY social_identity_provider_subject_uniq (provider, provider_subject),
    UNIQUE KEY social_identity_user_provider_uniq (user_id, provider),
    KEY social_identity_email_idx (provider_email),
    CONSTRAINT social_identity_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE social_auth_attempts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    state_hash CHAR(64) NOT NULL,
    nonce_hash CHAR(64) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    mode ENUM('login','bind') NOT NULL DEFAULT 'login',
    user_id BIGINT UNSIGNED NULL,
    return_to VARCHAR(512) NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent VARCHAR(512) NULL,
    expires_at TIMESTAMP NOT NULL,
    consumed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY social_auth_state_uniq (state_hash),
    KEY social_auth_provider_expiry_idx (provider, expires_at),
    KEY social_auth_user_idx (user_id),
    CONSTRAINT social_auth_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
