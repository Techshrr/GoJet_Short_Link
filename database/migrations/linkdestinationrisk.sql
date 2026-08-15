CREATE TABLE link_destination_risk (
    link_id BIGINT UNSIGNED PRIMARY KEY,
    decision ENUM('allow','review','block') NOT NULL DEFAULT 'review',
    score SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    categories JSON NULL,
    evidence JSON NULL,
    provider VARCHAR(80) NOT NULL DEFAULT 'builtin',
    target_fingerprint CHAR(32) NOT NULL DEFAULT '',
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

-- Existing links enter REVIEW and are scanned immediately. A migration baseline
-- is not a safety assessment and must never grant a temporary ALLOW window.
INSERT INTO link_destination_risk(
    link_id,decision,score,categories,evidence,provider,target_fingerprint,scanned_url,final_url,scanned_at,next_scan_at
)
SELECT
    id,
    'review',
    0,
    JSON_ARRAY(),
    JSON_OBJECT('reason','legacy migration baseline; review until first destination scan completes'),
    'migration_legacy',
    '',
    destination,
    destination,
    NULL,
    UTC_TIMESTAMP()
FROM short_links
WHERE deleted_at IS NULL;

CREATE TRIGGER short_links_destination_risk_invalidate
AFTER UPDATE ON short_links
FOR EACH ROW
UPDATE link_destination_risk
SET next_scan_at=UTC_TIMESTAMP(),
    manual_decision=NULL,
    manual_reason=NULL,
    manual_administrator_id=NULL,
    manual_at=NULL
WHERE link_id=NEW.id
  AND (
    NOT (OLD.destination <=> NEW.destination)
    OR NOT (OLD.routing_rules <=> NEW.routing_rules)
    OR NOT (OLD.ab_destinations <=> NEW.ab_destinations)
  );
