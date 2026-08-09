ALTER TABLE workspace_invitations MODIFY status ENUM('pending','accepted','rejected','expired','revoked') NOT NULL DEFAULT 'pending',ADD COLUMN rejected_at DATETIME NULL AFTER accepted_at;
