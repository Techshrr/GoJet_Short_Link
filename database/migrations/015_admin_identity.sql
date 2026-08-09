CREATE TABLE administrators (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(40) NOT NULL DEFAULT 'custom',
    status ENUM('active','suspended') NOT NULL DEFAULT 'active',
    totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY administrators_email_unique(email),
    KEY administrators_role_status_idx(role,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE administrator_permissions (
    administrator_id BIGINT UNSIGNED NOT NULL,
    permission VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(administrator_id,permission),
    FOREIGN KEY(administrator_id) REFERENCES administrators(id) ON DELETE CASCADE,
    KEY administrator_permission_lookup_idx(permission,administrator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE administrator_sessions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    administrator_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    expires_at DATETIME NOT NULL,
    last_seen_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(administrator_id) REFERENCES administrators(id) ON DELETE CASCADE,
    UNIQUE KEY administrator_sessions_token_unique(token_hash),
    KEY administrator_sessions_expiry_idx(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE administrator_audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    administrator_id BIGINT UNSIGNED NULL,
    action VARCHAR(120) NOT NULL,
    method VARCHAR(10) NULL,
    path VARCHAR(500) NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    outcome ENUM('success','failure') NOT NULL,
    reason VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(administrator_id) REFERENCES administrators(id) ON DELETE SET NULL,
    KEY administrator_audit_actor_created_idx(administrator_id,created_at),
    KEY administrator_audit_action_created_idx(action,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
