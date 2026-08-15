ALTER TABLE billing_invoices
    ADD COLUMN billing_cycle ENUM('monthly','quarterly','semiannual','annual') NOT NULL DEFAULT 'monthly' AFTER invoice_type,
    ADD COLUMN period_months TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER billing_cycle;

UPDATE billing_invoices
SET billing_cycle = CASE
        WHEN period_days >= 330 THEN 'annual'
        WHEN period_days >= 150 THEN 'semiannual'
        WHEN period_days >= 75 THEN 'quarterly'
        ELSE 'monthly'
    END,
    period_months = CASE
        WHEN period_days >= 330 THEN 12
        WHEN period_days >= 150 THEN 6
        WHEN period_days >= 75 THEN 3
        ELSE 1
    END;
