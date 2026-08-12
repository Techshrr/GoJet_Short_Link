CREATE TABLE structured_logs(
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    occurred_at DATETIME(6) NOT NULL,
    service VARCHAR(80) NOT NULL,
    level ENUM('debug','info','warn','error') NOT NULL,
    event VARCHAR(120) NOT NULL,
    request_id VARCHAR(64) NULL,
    status_code INT NULL,
    duration_ms BIGINT NULL,
    payload JSON NOT NULL,
    received_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY structured_logs_occurred_idx(occurred_at),
    KEY structured_logs_service_level_idx(service,level,occurred_at),
    KEY structured_logs_request_idx(request_id,occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE log_retention_policy(
    id TINYINT UNSIGNED PRIMARY KEY,
    retention_days SMALLINT UNSIGNED NOT NULL DEFAULT 30,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CHECK(id=1), CHECK(retention_days BETWEEN 1 AND 365)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO log_retention_policy(id,retention_days) VALUES(1,30);
