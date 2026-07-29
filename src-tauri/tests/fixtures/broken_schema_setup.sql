CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
INSERT INTO schema_version (version) VALUES (1);
CREATE TABLE customers (customer_id VARCHAR PRIMARY KEY, first_seen DATE NOT NULL, status VARCHAR NOT NULL, metadata VARCHAR);
-- mrr_log is MISSING here!
