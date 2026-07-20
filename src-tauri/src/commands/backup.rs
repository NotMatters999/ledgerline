use tauri::State;
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;
use crate::commands::workspace::AppState;
use crate::utils::error::LedgerlineError;
use crate::utils::logger::log_info;

// Basic in-memory store for confirmation tokens
pub struct BackupTokenStore {
    pub tokens: Mutex<HashMap<String, String>>, // filename -> token
}

impl BackupTokenStore {
    pub fn new() -> Self {
        Self {
            tokens: Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
pub fn backup_list(_workspace_id: String, state: State<'_, AppState>) -> Result<Vec<String>, LedgerlineError> {
    // Assuming workspace_id is "default" for now, which maps to name "default"
    state.backup_manager.list_backups("default").map_err(LedgerlineError::from)
}

#[tauri::command]
pub fn backup_create(_workspace_id: String, state: State<'_, AppState>) -> Result<String, LedgerlineError> {
    log_info("Backup", "Starting manual backup creation");
    let mgr = state.workspace_manager.lock().unwrap();
    let workspaces = mgr.list_workspaces().map_err(LedgerlineError::from)?;
    let ws = workspaces.iter().find(|w| w.id == _workspace_id).ok_or("Workspace not found")?;
    
    let path = state.backup_manager.backup(&ws.db_path, &ws.name).map_err(LedgerlineError::from)?;
    log_info("Backup", "Manual backup creation completed successfully");
    Ok(path.file_name().unwrap().to_str().unwrap().to_string())
}

#[tauri::command]
pub fn backup_restore_request(filename: String, token_store: State<'_, BackupTokenStore>) -> Result<String, LedgerlineError> {
    log_info("Backup", &format!("Restore request initiated for {}", filename));
    let token = Uuid::new_v4().to_string();
    let mut store = token_store.tokens.lock().unwrap();
    store.insert(filename, token.clone());
    Ok(token)
}

#[tauri::command]
pub fn backup_restore_confirm(_workspace_id: String, filename: String, token: String, state: State<'_, AppState>, token_store: State<'_, BackupTokenStore>) -> Result<(), LedgerlineError> {
    {
        let mut store = token_store.tokens.lock().unwrap();
        if let Some(expected_token) = store.get(&filename) {
            if expected_token != &token {
                return Err(LedgerlineError::from("Invalid confirmation token"));
            }
            store.remove(&filename);
        } else {
            return Err(LedgerlineError::from("No restore request found for this backup"));
        }
    }
    
    let mgr = state.workspace_manager.lock().unwrap();
    // Connections are opened ephemerally by handlers, no need to explicitly close here.
    
    let workspaces = mgr.list_workspaces().map_err(LedgerlineError::from)?;
    let ws = workspaces.iter().find(|w| w.id == _workspace_id).ok_or("Workspace not found")?;
    
    // Compute absolute path of the backup file using the backup manager's known app data dir
    let backup_path = state.backup_manager.app_data_dir.join("backups").join(&ws.name).join(&filename);
    
    if !backup_path.exists() {
        return Err(LedgerlineError::from("Backup file does not exist"));
    }

    state.backup_manager.restore(&backup_path, &ws.db_path).map_err(LedgerlineError::from)?;
    log_info("Backup", &format!("Restore confirmed and executed for {}", filename));
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use crate::workspace::manager::WorkspaceManager;
    use crate::workspace::backup::BackupManager;
    use tempfile::tempdir;
    use duckdb::Connection;

    #[test]
    fn test_restore_checksum_verification() {
        let dir = tempdir().unwrap();
        let app_dir = dir.path().to_path_buf();
        
        let ws_mgr = WorkspaceManager::new(&app_dir).unwrap();
        let bk_mgr = BackupManager::new(&app_dir);
        
        ws_mgr.create_workspace("TestWS").unwrap();
        let ws = ws_mgr.list_workspaces().unwrap().into_iter().find(|w| w.name == "TestWS").unwrap();
        
        // 1. Initial State
        {
            let conn = Connection::open(&ws.db_path).unwrap();
            conn.execute_batch("CREATE TABLE data (id INTEGER); INSERT INTO data VALUES (1), (2);").unwrap();
        }
        
        // 2. Backup
        let backup_file = bk_mgr.backup(&ws.db_path, "TestWS").unwrap();
        
        // 3. Mutate Database (simulate user error / destructive action)
        {
            let conn = Connection::open(&ws.db_path).unwrap();
            conn.execute_batch("DELETE FROM data; INSERT INTO data VALUES (99);").unwrap();
        }
        
        // Ensure mutation happened
        {
            let conn = Connection::open(&ws.db_path).unwrap();
            let count: i64 = conn.query_row("SELECT COUNT(*) FROM data", [], |row| row.get(0)).unwrap();
            assert_eq!(count, 1); // Only the 99 row
        }
        
        // 4. Restore
        bk_mgr.restore(&backup_file, &ws.db_path).unwrap();
        
        // 5. Verification: Checksum / Row Count exactly recovered
        {
            let conn = Connection::open(&ws.db_path).unwrap();
            let count: i64 = conn.query_row("SELECT COUNT(*) FROM data", [], |row| row.get(0)).unwrap();
            assert_eq!(count, 2); // The original 2 rows are back!
            
            let sum: i64 = conn.query_row("SELECT SUM(id) FROM data", [], |row| row.get(0)).unwrap();
            assert_eq!(sum, 3); // 1 + 2 = 3
        }
    }
}
