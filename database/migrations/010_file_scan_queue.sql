ALTER TABLE file_shares
    MODIFY scan_status ENUM('pending','scanning','clean','infected','error') NOT NULL DEFAULT 'pending',
    ADD COLUMN scan_attempts INT UNSIGNED NOT NULL DEFAULT 0 AFTER scan_result,
    ADD COLUMN next_scan_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER scan_attempts,
    ADD COLUMN last_scanned_at DATETIME NULL AFTER next_scan_at,
    ADD KEY file_scan_queue_idx(scan_status,next_scan_at);
