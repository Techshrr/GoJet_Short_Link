CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(120) NOT NULL,
    setting_value LONGTEXT NULL,
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mail_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    message_type VARCHAR(40) NOT NULL,
    recipient VARCHAR(320) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body_html MEDIUMTEXT NOT NULL,
    status ENUM('pending','sending','sent','failed') NOT NULL DEFAULT 'pending',
    message_id VARCHAR(255) NULL,
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY mail_messages_queue_idx (status, available_at),
    KEY mail_messages_recipient_idx (recipient)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mail_health (
    singleton_id TINYINT UNSIGNED NOT NULL DEFAULT 1,
    status ENUM('unconfigured','connected','failed') NOT NULL DEFAULT 'unconfigured',
    last_tested_at DATETIME NULL,
    last_success_at DATETIME NULL,
    last_error TEXT NULL,
    PRIMARY KEY (singleton_id),
    CONSTRAINT mail_health_singleton CHECK (singleton_id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO mail_health(singleton_id,status) VALUES(1,'unconfigured');
