use duckdb::{Connection, Result};
use std::path::Path;

pub fn open_connection<P: AsRef<Path>>(db_path: P) -> Result<Connection> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS mrr_log (
            customer_id VARCHAR NOT NULL,
            period DATE NOT NULL,
            mrr_amount DOUBLE NOT NULL,
            currency VARCHAR NOT NULL
        );
        CREATE TABLE IF NOT EXISTS import_history (
            id VARCHAR PRIMARY KEY,
            file_hash VARCHAR NOT NULL,
            fingerprint VARCHAR NOT NULL,
            imported_at TIMESTAMP NOT NULL,
            row_count BIGINT NOT NULL,
            status VARCHAR NOT NULL,
            total_amount DOUBLE NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
            key VARCHAR PRIMARY KEY,
            value VARCHAR NOT NULL
        );
        CREATE TABLE IF NOT EXISTS monthly_assumptions (
            month VARCHAR PRIMARY KEY,
            marketing_spend DOUBLE,
            gross_margin DOUBLE,
            created_at TIMESTAMP,
            updated_at TIMESTAMP
        );"
    )?;
    Ok(conn)
}
