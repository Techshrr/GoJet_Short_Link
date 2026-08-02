ALTER TABLE user_sessions
    ADD COLUMN ip_address VARCHAR(45) NULL AFTER user_id,
    ADD COLUMN user_agent VARCHAR(500) NULL AFTER ip_address,
    ADD COLUMN last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER user_agent,
    ADD COLUMN revoked_at DATETIME NULL AFTER expires_at,
    ADD KEY user_sessions_user_created_idx(user_id,created_at),
    ADD KEY user_sessions_active_idx(expires_at,revoked_at);

CREATE TABLE admin_resource_quarantine (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    resource_type ENUM('link','text','bio','qr','file') NOT NULL,
    resource_id BIGINT UNSIGNED NOT NULL,
    workspace_id BIGINT UNSIGNED NOT NULL,
    previous_status VARCHAR(40) NULL,
    previous_deleted_at DATETIME NULL,
    status ENUM('quarantined','restored') NOT NULL DEFAULT 'quarantined',
    reason VARCHAR(500) NOT NULL,
    quarantined_by BIGINT UNSIGNED NOT NULL,
    quarantined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    restored_by BIGINT UNSIGNED NULL,
    restored_at DATETIME NULL,
    restore_reason VARCHAR(500) NULL,
    active_resource VARCHAR(100) GENERATED ALWAYS AS (IF(status='quarantined',CONCAT(resource_type,':',resource_id),NULL)) STORED,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(quarantined_by) REFERENCES administrators(id),
    FOREIGN KEY(restored_by) REFERENCES administrators(id),
    UNIQUE KEY admin_quarantine_active_unique(active_resource),
    KEY admin_quarantine_status_created_idx(status,quarantined_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE system_job_runs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_name VARCHAR(100) NOT NULL,
    status ENUM('running','success','failure') NOT NULL,
    triggered_by BIGINT UNSIGNED NULL,
    details JSON NULL,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME NULL,
    FOREIGN KEY(triggered_by) REFERENCES administrators(id) ON DELETE SET NULL,
    KEY system_job_name_started_idx(job_name,started_at),
    KEY system_job_status_started_idx(status,started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
