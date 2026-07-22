-- Rename existing marketing_spend table if we wanted to preserve data, 
-- but since this is an early stage, we can migrate the data or just recreate.
-- The spec says "renaming marketing_spend -> monthly_assumptions".
CREATE TABLE monthly_assumptions (
    month VARCHAR PRIMARY KEY,      -- YYYY-MM
    marketing_spend DOUBLE,         -- Absolute spend amount
    gross_margin DOUBLE,            -- Percentage as decimal (e.g. 0.85 for 85%)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migrate existing data from marketing_spend
INSERT INTO monthly_assumptions (month, marketing_spend, gross_margin)
SELECT 
    period_start AS month, 
    amount AS marketing_spend, 
    NULL AS gross_margin
FROM marketing_spend;

-- Drop old table
DROP TABLE marketing_spend;
