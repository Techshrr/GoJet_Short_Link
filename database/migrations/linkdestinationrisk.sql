CREATE TABLE link_destination_risk (
    link_id BIGINT UNSIGNED PRIMARY KEY,
    decision ENUM('allow','review','block') NOT NULL DEFAULT 'review',
    score SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    categories JSON NULL,
    evidence JSON NULL,
    provider VARCHAR(80) NOT NULL DEFAULT 'builtin',
    scanned_url TEXT NOT NULL,
    final_url TEXT NOT NULL,
    scanned_at DATETIME NULL,
    next_scan_at DATETIME NULL,
    manual_decision ENUM('allow','review','block') NULL,
    manual_reason VARCHAR(500) NULL,
    manual_administrator_id BIGINT UNSIGNED NULL,
    manual_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT link_destination_risk_link_fk FOREIGN KEY(link_id) REFERENCES short_links(id) ON DELETE CASCADE,
    CONSTRAINT link_destination_risk_admin_fk FOREIGN KEY(manual_administrator_id) REFERENCES administrators(id) ON DELETE SET NULL,
    KEY link_destination_risk_decision_next_idx(decision,next_scan_at),
    KEY link_destination_risk_manual_idx(manual_decision,manual_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO link_destination_risk(
    link_id,decision,score,categories,evidence,provider,scanned_url,final_url,scanned_at,next_scan_at
)
SELECT
    id,
    'allow',
    0,
    JSON_ARRAY(),
    JSON_OBJECT('reason','legacy migration baseline; queued for scheduled rescan'),
    'migration_legacy',
    destination,
    destination,
    UTC_TIMESTAMP(),
    DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY)
FROM short_links
WHERE deleted_at IS NULL;
