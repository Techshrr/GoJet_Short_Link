ALTER TABLE text_shares
    ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
    ADD COLUMN deleted_at DATETIME NULL AFTER updated_at,
    ADD KEY text_shares_workspace_deleted_idx(workspace_id,deleted_at,created_at);

ALTER TABLE bio_pages
    ADD COLUMN deleted_at DATETIME NULL AFTER updated_at,
    ADD KEY bio_pages_workspace_deleted_idx(workspace_id,deleted_at,created_at);

ALTER TABLE qr_codes
    ADD COLUMN deleted_at DATETIME NULL AFTER created_at,
    ADD KEY qr_workspace_deleted_idx(workspace_id,deleted_at,created_at);
