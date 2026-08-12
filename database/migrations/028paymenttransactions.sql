CREATE TABLE payment_transactions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    invoice_id BIGINT UNSIGNED NOT NULL,
    workspace_id BIGINT UNSIGNED NOT NULL,
    provider VARCHAR(32) NOT NULL,
    merchant_order_no VARCHAR(64) NOT NULL,
    provider_order_id VARCHAR(128) NULL,
    amount_cents BIGINT UNSIGNED NOT NULL,
    currency CHAR(3) NOT NULL,
    status ENUM('created','pending','paid','failed','cancelled','refunded') NOT NULL DEFAULT 'created',
    checkout_url TEXT NULL,
    qr_content TEXT NULL,
    provider_payload JSON NULL,
    failure_reason VARCHAR(255) NOT NULL DEFAULT '',
    paid_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY(invoice_id) REFERENCES billing_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    UNIQUE KEY payment_merchant_order_unique(merchant_order_no),
    UNIQUE KEY payment_provider_order_unique(provider,provider_order_id),
    KEY payment_invoice_status_idx(invoice_id,status),
    KEY payment_workspace_created_idx(workspace_id,created_at),
    KEY payment_provider_status_idx(provider,status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE billing_invoices
    ADD COLUMN paid_via VARCHAR(32) NOT NULL DEFAULT '' AFTER status,
    ADD COLUMN payment_reference VARCHAR(128) NOT NULL DEFAULT '' AFTER paid_via;
