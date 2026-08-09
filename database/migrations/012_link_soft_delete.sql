ALTER TABLE short_links
    ADD COLUMN deleted_at DATETIME NULL AFTER updated_at,
    ADD KEY links_workspace_deleted_idx(workspace_id,deleted_at,created_at);
