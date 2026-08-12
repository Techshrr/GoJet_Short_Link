ALTER TABLE file_shares
    ADD COLUMN password_hash VARCHAR(255) NULL AFTER max_downloads;
