CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS customers (
    customer_id VARCHAR PRIMARY KEY,
    first_seen DATE NOT NULL,
    status VARCHAR NOT NULL,
    metadata JSON
);

CREATE TABLE IF NOT EXISTS mrr_log (
    customer_id VARCHAR NOT NULL,
    period DATE NOT NULL,
    mrr_amount DOUBLE NOT NULL,
    currency VARCHAR,
    PRIMARY KEY (customer_id, period)
);

CREATE TABLE IF NOT EXISTS marketing_spend (
    period DATE NOT NULL,
    amount DOUBLE NOT NULL,
    channel VARCHAR
);

CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR PRIMARY KEY,
    value VARCHAR NOT NULL
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
