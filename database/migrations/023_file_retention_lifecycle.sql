ALTER TABLE file_shares
    MODIFY status ENUM('active','quarantined','expired','paused','deleted') NOT NULL DEFAULT 'quarantined',
    ADD COLUMN deleted_at DATETIME NULL AFTER last_scanned_at,
    ADD COLUMN purge_after DATETIME NULL AFTER deleted_at,
    ADD COLUMN deleted_object_key VARCHAR(320) NULL AFTER purge_after,
    ADD KEY file_retention_idx(status,purge_after);
