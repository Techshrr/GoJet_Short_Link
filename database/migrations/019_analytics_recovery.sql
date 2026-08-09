ALTER TABLE analytics_worker_failures
    ADD COLUMN state ENUM('retrying','dead_letter','resolved') NOT NULL DEFAULT 'retrying' AFTER attempts,
    ADD COLUMN resolved_at DATETIME NULL AFTER last_failed_at,
    ADD KEY analytics_failure_state_idx(state,last_failed_at);

CREATE TABLE analytics_reconciliation (
    link_id VARCHAR(64) PRIMARY KEY,
    redis_clicks BIGINT UNSIGNED NOT NULL,
    mysql_clicks BIGINT UNSIGNED NOT NULL,
    delta BIGINT NOT NULL,
    status ENUM('consistent','worker_lag','redis_repaired') NOT NULL,
    detail VARCHAR(500) NOT NULL DEFAULT '',
    checked_at DATETIME NOT NULL,
    first_mismatch_at DATETIME NULL,
    resolved_at DATETIME NULL,
    KEY analytics_reconciliation_status_idx(status,checked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
