use serde::Serialize;
use std::fmt;
use crate::utils::logger::log_error;

#[derive(Debug)]
pub struct LedgerlineError {
    pub message: String,
}

impl serde::Serialize for LedgerlineError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.message)
    }
}

impl fmt::Display for LedgerlineError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for LedgerlineError {}

// Catch-all conversion for any error string
impl From<String> for LedgerlineError {
    fn from(msg: String) -> Self {
        log_error("IPC_Boundary", &msg);
        LedgerlineError { message: msg }
    }
}

impl From<&str> for LedgerlineError {
    fn from(msg: &str) -> Self {
        log_error("IPC_Boundary", msg);
        LedgerlineError { message: msg.to_string() }
    }
}

// Convert from standard IO error
impl From<std::io::Error> for LedgerlineError {
    fn from(err: std::io::Error) -> Self {
        let msg = err.to_string();
        log_error("IO_Boundary", &msg);
        LedgerlineError { message: msg }
    }
}

// Map any std error into LedgerlineError (if we needed a generic catch)
// But typically we convert specific domains, e.g. DuckDB
impl From<duckdb::Error> for LedgerlineError {
    fn from(err: duckdb::Error) -> Self {
        let msg = err.to_string();
        log_error("DuckDB_Boundary", &msg);
        LedgerlineError { message: msg }
    }
}

// Convert from WorkspaceError
impl From<crate::workspace::manager::WorkspaceError> for LedgerlineError {
    fn from(err: crate::workspace::manager::WorkspaceError) -> Self {
        let msg = err.to_string();
        log_error("Workspace_Boundary", &msg);
        LedgerlineError { message: msg }
    }
}

// Convert from ImportError
impl From<crate::import::pipeline::ImportError> for LedgerlineError {
    fn from(err: crate::import::pipeline::ImportError) -> Self {
        let msg = err.to_string();
        log_error("Import_Boundary", &msg);
        LedgerlineError { message: msg }
    }
}
