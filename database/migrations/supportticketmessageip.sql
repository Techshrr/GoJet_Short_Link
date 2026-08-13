ALTER TABLE support_ticket_messages
    ADD COLUMN ip_address VARCHAR(64) NULL AFTER is_internal,
    ADD KEY support_ticket_messages_ip_idx(ip_address);
