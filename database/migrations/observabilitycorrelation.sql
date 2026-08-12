ALTER TABLE analytics_events ADD COLUMN request_id VARCHAR(64) NULL AFTER stream_id, ADD KEY analytics_events_request_id_idx(request_id);
ALTER TABLE audit_logs ADD COLUMN request_id VARCHAR(64) NULL AFTER target_id, ADD KEY audit_logs_request_id_idx(request_id);
ALTER TABLE administrator_audit_logs ADD COLUMN request_id VARCHAR(64) NULL AFTER path, ADD KEY administrator_audit_request_id_idx(request_id);
