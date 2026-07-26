use duckdb::{Connection, Result};
use std::path::Path;

pub fn open_connection<P: AsRef<Path>>(db_path: P) -> Result<Connection> {
    let mut conn = Connection::open(db_path)?;
    crate::db::migrations::run_migrations(&mut conn)?;
    Ok(conn)
}
