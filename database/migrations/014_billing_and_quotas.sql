CREATE TABLE plans (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(80) NOT NULL,
    link_limit BIGINT UNSIGNED NOT NULL,
    qr_limit BIGINT UNSIGNED NOT NULL,
    text_limit BIGINT UNSIGNED NOT NULL,
    bio_limit BIGINT UNSIGNED NOT NULL,
    file_storage_bytes BIGINT UNSIGNED NOT NULL,
    member_limit BIGINT UNSIGNED NOT NULL,
    analytics_retention_days INT UNSIGNED NOT NULL,
    status ENUM('active','archived') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY plans_code_unique(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO plans(code,name,link_limit,qr_limit,text_limit,bio_limit,file_storage_bytes,member_limit,analytics_retention_days)
VALUES('starter','基础版',100,25,25,3,1073741824,3,30);

CREATE TABLE workspace_subscriptions (
    workspace_id BIGINT UNSIGNED PRIMARY KEY,
    plan_id BIGINT UNSIGNED NOT NULL,
    status ENUM('active','past_due','cancelled') NOT NULL DEFAULT 'active',
    period_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    period_ends_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(plan_id) REFERENCES plans(id),
    KEY subscriptions_plan_status_idx(plan_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO workspace_subscriptions(workspace_id,plan_id)
SELECT w.id,p.id FROM workspaces w JOIN plans p ON p.code='starter';
