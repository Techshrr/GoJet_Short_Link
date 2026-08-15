-- Correct installations where the original destination-risk migration created a
-- temporary ALLOW baseline for existing links. A migration row is not evidence
-- that a target is safe, so unreviewed legacy rows must become REVIEW and enter
-- the scan queue immediately.
UPDATE link_destination_risk
SET decision='review',
    score=0,
    categories=JSON_ARRAY(),
    evidence=JSON_OBJECT('reason','legacy migration baseline corrected; review until first destination scan completes'),
    target_fingerprint='',
    scanned_at=NULL,
    next_scan_at=UTC_TIMESTAMP()
WHERE provider='migration_legacy'
  AND manual_decision IS NULL;
