-- Rename existing marketing_spend table if we wanted to preserve data, 
-- but since this is an early stage, we can migrate the data or just recreate.
-- The spec says "renaming marketing_spend -> monthly_assumptions".
CREATE TABLE IF NOT EXISTS monthly_assumptions (
    month VARCHAR PRIMARY KEY,      -- YYYY-MM
    marketing_spend DOUBLE,         -- Absolute spend amount
    gross_margin DOUBLE,            -- Percentage as decimal (e.g. 0.85 for 85%)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure the old table exists for migration; if it does not, this creates an empty placeholder so the migration is safe on reruns.
CREATE TABLE IF NOT EXISTS marketing_spend (
    period DATE NOT NULL,
    amount DOUBLE NOT NULL,
    channel VARCHAR
);

-- Migrate existing data from marketing_spend only once.
INSERT INTO monthly_assumptions (month, marketing_spend, gross_margin)
SELECT 
    strftime(period, '%Y-%m') AS month, 
    SUM(amount) AS marketing_spend, 
    NULL AS gross_margin
FROM marketing_spend
WHERE NOT EXISTS (SELECT 1 FROM monthly_assumptions)
GROUP BY strftime(period, '%Y-%m');

-- Drop old table if it still exists.
DROP TABLE IF EXISTS marketing_spend;
