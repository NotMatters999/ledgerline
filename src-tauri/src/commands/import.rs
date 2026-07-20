use tauri::State;
use std::path::PathBuf;
use crate::commands::workspace::AppState;
use crate::import::pipeline::{preview, commit, PreviewResult, ImportError};
use crate::db::connection::open_connection;
use crate::utils::error::LedgerlineError;
use crate::utils::logger::log_info;

#[tauri::command]
pub fn import_preview(_workspace_id: String, file_path: String, _state: State<'_, AppState>) -> Result<PreviewResult, LedgerlineError> {
    // Just run preview
    preview(PathBuf::from(file_path).as_path()).map_err(LedgerlineError::from)
}

#[tauri::command]
pub fn import_commit(workspace_id: String, file_path: String, state: State<'_, AppState>) -> Result<(), LedgerlineError> {
    log_info("Import", &format!("Starting import commit for file: {}", file_path));
    let (ws_name, db_path) = {
        let mgr = state.workspace_manager.lock().unwrap();
        let workspaces = mgr.list_workspaces().map_err(|_| ImportError::Database(duckdb::Error::QueryReturnedNoRows))?;
        let ws = workspaces.iter().find(|w| w.id == workspace_id).ok_or_else(|| ImportError::Database(duckdb::Error::QueryReturnedNoRows))?;
        (ws.name.clone(), ws.db_path.clone())
    };
    
    // Automated Snapshot: Protect the ledger before massive mutation
    // This synchronously copies the .duckdb file (usually <100MB, taking ~5-50ms on modern SSDs).
    if let Err(e) = state.backup_manager.backup(&db_path, &ws_name) {
        // If backup fails, we abort the import to prevent unsafe mutation without a rollback net
        return Err(LedgerlineError::from(ImportError::Parser(crate::import::parser::ParserError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("Failed to create safety snapshot: {}", e))))));
    }

    let mut conn = open_connection(&db_path).map_err(LedgerlineError::from)?;
    commit(&mut conn, PathBuf::from(file_path).as_path()).map_err(LedgerlineError::from)?;
    
    log_info("Import", "Import commit completed successfully");
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::Instant;
    use tempfile::tempdir;
    use crate::workspace::manager::WorkspaceManager;
    use crate::workspace::backup::BackupManager;

    #[test]
    fn test_import_snapshot_performance_budget() {
        let dir = tempdir().unwrap();
        let app_dir = dir.path().to_path_buf();
        let ws_mgr = WorkspaceManager::new(&app_dir).unwrap();
        let bk_mgr = BackupManager::new(&app_dir);
        
        ws_mgr.create_workspace("PerfTest").unwrap();
        let ws = ws_mgr.list_workspaces().unwrap().into_iter().find(|w| w.name == "PerfTest").unwrap();
        
        // Generate a dummy file to simulate a medium-sized DuckDB file (e.g. 50MB)
        let dummy_data = vec![0u8; 50 * 1024 * 1024];
        fs::write(&ws.db_path, dummy_data).unwrap();
        
        let start = Instant::now();
        bk_mgr.backup(&ws.db_path, &ws.name).unwrap();
        let elapsed = start.elapsed();
        
        // The spec requires 100k rows (approx 10-50MB) to import in < 5 seconds.
        // Copying the DB snapshot should take a tiny fraction of that budget (e.g. < 500ms).
        assert!(elapsed.as_millis() < 500, "Snapshotting a 50MB DB took too long ({}ms) - jeopardizes 5s import budget", elapsed.as_millis());
    }
}
