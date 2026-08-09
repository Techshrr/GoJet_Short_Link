ALTER TABLE administrator_sessions
    ADD COLUMN step_up_until DATETIME NULL AFTER last_seen_at;

CREATE INDEX administrator_sessions_step_up_idx
    ON administrator_sessions(administrator_id, step_up_until);
