-- This migration runs IF NOT EXISTS checks on all tables.
-- It exists specifically to repair broken workspaces that recorded version 1 but failed to create some tables.
CREATE TABLE IF NOT EXISTS mrr_log (
    customer_id VARCHAR NOT NULL,
    period DATE NOT NULL,
    mrr_amount DOUBLE NOT NULL,
    currency VARCHAR,
    category VARCHAR,
    PRIMARY KEY (customer_id, period)
);

CREATE TABLE IF NOT EXISTS customers (
    customer_id VARCHAR PRIMARY KEY,
    first_seen DATE NOT NULL,
    status VARCHAR NOT NULL,
    metadata VARCHAR
);

CREATE TABLE IF NOT EXISTS import_history (
    id VARCHAR PRIMARY KEY,
    file_hash VARCHAR NOT NULL,
    fingerprint VARCHAR NOT NULL,
    imported_at TIMESTAMP NOT NULL,
    row_count INTEGER NOT NULL,
    status VARCHAR NOT NULL,
    total_amount DOUBLE NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR PRIMARY KEY,
    value VARCHAR NOT NULL
);

-- Note: monthly_assumptions was added in 0002, so it's technically covered there, 
-- but no harm in ensuring it exists here too as a safety net.
CREATE TABLE IF NOT EXISTS monthly_assumptions (
    month VARCHAR PRIMARY KEY,
    marketing_spend DOUBLE,
    gross_margin DOUBLE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
