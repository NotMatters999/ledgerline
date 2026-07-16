use duckdb::{Connection, Result};
use std::path::Path;

pub fn open_connection<P: AsRef<Path>>(db_path: P) -> Result<Connection> {
    Connection::open(db_path)
}
