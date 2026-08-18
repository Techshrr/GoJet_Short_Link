ALTER TABLE plans
    ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE AFTER status,
    ADD COLUMN display_order INT UNSIGNED NOT NULL DEFAULT 0 AFTER is_public,
    ADD COLUMN billing_periods JSON NULL AFTER display_order;

UPDATE plans
SET billing_periods=JSON_ARRAY('monthly','quarterly','semiannual','annual'),
    display_order=CASE code WHEN 'starter' THEN 10 WHEN 'pro' THEN 20 WHEN 'business' THEN 30 ELSE id*10 END
WHERE billing_periods IS NULL;

CREATE INDEX plans_public_display_idx ON plans(status,is_public,display_order,id);
