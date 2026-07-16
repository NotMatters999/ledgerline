use tauri::State;
use std::path::PathBuf;
use crate::workspace::manager::{WorkspaceManager, Workspace, WorkspaceError};
use crate::workspace::backup::BackupManager;
use crate::utils::error::LedgerlineError;
use crate::utils::logger::log_info;

pub struct AppState {
    pub workspace_manager: std::sync::Mutex<WorkspaceManager>,
    pub backup_manager: BackupManager,
}

#[tauri::command]
pub fn workspace_list(state: State<'_, AppState>) -> Result<Vec<Workspace>, LedgerlineError> {
    let mgr = state.workspace_manager.lock().unwrap();
    mgr.list_workspaces().map_err(LedgerlineError::from)
}

#[tauri::command]
pub fn workspace_create(name: String, state: State<'_, AppState>) -> Result<Workspace, LedgerlineError> {
    log_info("Workspace", &format!("Creating workspace: {}", name));
    let mgr = state.workspace_manager.lock().unwrap();
    mgr.create_workspace(&name).map_err(LedgerlineError::from)
}

#[tauri::command]
pub fn workspace_rename(id: String, new_name: String, state: State<'_, AppState>) -> Result<Workspace, LedgerlineError> {
    log_info("Workspace", &format!("Renaming workspace {} to {}", id, new_name));
    let mgr = state.workspace_manager.lock().unwrap();
    mgr.rename_workspace(&id, &new_name).map_err(LedgerlineError::from)
}

#[tauri::command]
pub fn workspace_switch(id: String, state: State<'_, AppState>) -> Result<Workspace, LedgerlineError> {
    log_info("Workspace", &format!("Switching to workspace {}", id));
    let mgr = state.workspace_manager.lock().unwrap();
    mgr.mark_accessed(&id).map_err(LedgerlineError::from)
}

#[tauri::command]
pub fn workspace_delete_request(id: String, state: State<'_, AppState>) -> Result<String, LedgerlineError> {
    log_info("Workspace", &format!("Delete request initiated for workspace {}", id));
    let mgr = state.workspace_manager.lock().unwrap();
    mgr.request_delete(&id).map_err(LedgerlineError::from)
}

#[tauri::command]
pub fn workspace_delete_confirm(token: String, state: State<'_, AppState>) -> Result<(), LedgerlineError> {
    let mgr = state.workspace_manager.lock().unwrap();
    mgr.confirm_delete(&token).map_err(LedgerlineError::from)
}

#[tauri::command]
pub fn workspace_backup(id: String, state: State<'_, AppState>) -> Result<PathBuf, LedgerlineError> {
    let mgr = state.workspace_manager.lock().unwrap();
    let workspaces = mgr.list_workspaces().map_err(LedgerlineError::from)?;
    let ws = workspaces.iter().find(|w| w.id == id).ok_or_else(|| LedgerlineError::from(WorkspaceError::NotFound(id.clone())))?;
    
    state.backup_manager.backup(&ws.db_path, &ws.name).map_err(LedgerlineError::from)
}

#[tauri::command]
pub fn workspace_restore(id: String, backup_path: PathBuf, state: State<'_, AppState>) -> Result<(), LedgerlineError> {
    let mgr = state.workspace_manager.lock().unwrap();
    let workspaces = mgr.list_workspaces().map_err(LedgerlineError::from)?;
    let ws = workspaces.iter().find(|w| w.id == id).ok_or_else(|| LedgerlineError::from(WorkspaceError::NotFound(id.clone())))?;
    
    state.backup_manager.restore(&backup_path, &ws.db_path).map_err(LedgerlineError::from)
}
