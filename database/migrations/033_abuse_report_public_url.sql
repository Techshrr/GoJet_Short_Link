ALTER TABLE abuse_reports
    ADD COLUMN reported_url VARCHAR(2048) NOT NULL DEFAULT '' AFTER link_id,
    ADD KEY abuse_reported_url_idx(reported_url(191));
