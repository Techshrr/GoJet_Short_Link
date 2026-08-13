CREATE TABLE official_short_domains (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hostname VARCHAR(255) NOT NULL,
    label VARCHAR(120) NOT NULL DEFAULT '',
    status ENUM('active','disabled') NOT NULL DEFAULT 'active',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY official_short_domains_hostname_unique(hostname),
    KEY official_short_domains_active_sort_idx(status,sort_order,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
