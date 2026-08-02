ALTER TABLE plans
    ADD COLUMN monthly_price_cents BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER name,
    ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'CNY' AFTER monthly_price_cents,
    ADD COLUMN description VARCHAR(255) NOT NULL DEFAULT '' AFTER currency,
    ADD COLUMN features JSON NULL AFTER description;

UPDATE plans SET monthly_price_cents=0,description='适合个人和轻量项目',features=JSON_ARRAY('100 条短链接','30 天分析数据','3 位团队成员') WHERE code='starter';
INSERT INTO plans(code,name,monthly_price_cents,currency,description,features,link_limit,qr_limit,text_limit,bio_limit,file_storage_bytes,member_limit,analytics_retention_days)
VALUES
('pro','专业版',6900,'CNY','适合增长团队与专业创作者',JSON_ARRAY('5,000 条短链接','180 天分析数据','10 位团队成员','智能路由与 A/B 测试'),5000,1000,1000,50,10737418240,10,180),
('business','商业版',19900,'CNY','适合多成员品牌与大规模投放',JSON_ARRAY('50,000 条短链接','730 天分析数据','50 位团队成员','优先支持'),50000,10000,10000,500,107374182400,50,730);

ALTER TABLE workspace_subscriptions
    ADD COLUMN cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE AFTER period_ends_at,
    ADD COLUMN renewal_mode ENUM('manual','automatic') NOT NULL DEFAULT 'manual' AFTER cancel_at_period_end;

CREATE TABLE billing_invoices (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(40) NOT NULL,
    workspace_id BIGINT UNSIGNED NOT NULL,
    plan_id BIGINT UNSIGNED NOT NULL,
    requested_by BIGINT UNSIGNED NOT NULL,
    invoice_type ENUM('purchase','upgrade','renewal') NOT NULL,
    amount_cents BIGINT UNSIGNED NOT NULL,
    currency CHAR(3) NOT NULL,
    status ENUM('pending','paid','void','overdue') NOT NULL DEFAULT 'pending',
    period_days INT UNSIGNED NOT NULL DEFAULT 30,
    due_at DATETIME NOT NULL,
    paid_at DATETIME NULL,
    voided_at DATETIME NULL,
    admin_note VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(plan_id) REFERENCES plans(id),
    FOREIGN KEY(requested_by) REFERENCES users(id),
    UNIQUE KEY billing_invoice_number_unique(invoice_number),
    KEY billing_invoice_workspace_status_idx(workspace_id,status,created_at),
    KEY billing_invoice_status_due_idx(status,due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE subscription_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT UNSIGNED NOT NULL,
    invoice_id BIGINT UNSIGNED NULL,
    actor_type ENUM('user','administrator','system') NOT NULL,
    actor_id BIGINT UNSIGNED NULL,
    event_type VARCHAR(50) NOT NULL,
    from_plan_id BIGINT UNSIGNED NULL,
    to_plan_id BIGINT UNSIGNED NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(invoice_id) REFERENCES billing_invoices(id) ON DELETE SET NULL,
    KEY subscription_events_workspace_created_idx(workspace_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
