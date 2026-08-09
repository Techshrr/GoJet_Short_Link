CREATE TABLE IF NOT EXISTS analytics_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    stream_id VARCHAR(32) NOT NULL,
    link_id VARCHAR(64) NOT NULL,
    destination_id VARCHAR(64) NOT NULL,
    occurred_at DATETIME(3) NOT NULL,
    visitor_hash CHAR(64) NOT NULL,
    referer_url TEXT NULL,
    referer_host VARCHAR(255) NULL,
    source_type ENUM('direct', 'referer', 'unknown') NOT NULL,
    country CHAR(2) NULL,
    region VARCHAR(120) NULL,
    city VARCHAR(120) NULL,
    device VARCHAR(32) NOT NULL,
    browser VARCHAR(32) NOT NULL,
    operating_system VARCHAR(32) NOT NULL,
    language VARCHAR(35) NULL,
    utm_source VARCHAR(255) NULL,
    utm_medium VARCHAR(255) NULL,
    utm_campaign VARCHAR(255) NULL,
    utm_content VARCHAR(255) NULL,
    utm_term VARCHAR(255) NULL,
    visit_type VARCHAR(32) NOT NULL,
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY analytics_events_stream_id_unique (stream_id),
    KEY analytics_events_link_occurred_idx (link_id, occurred_at),
    KEY analytics_events_link_visitor_idx (link_id, visitor_hash),
    KEY analytics_events_link_source_idx (link_id, source_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_daily (
    link_id VARCHAR(64) NOT NULL,
    metric_date DATE NOT NULL,
    clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
    bot_visits BIGINT UNSIGNED NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (link_id, metric_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_worker_failures (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    stream_id VARCHAR(32) NOT NULL,
    error_message TEXT NOT NULL,
    attempts INT UNSIGNED NOT NULL DEFAULT 1,
    last_failed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY analytics_worker_failures_stream_id_unique (stream_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
