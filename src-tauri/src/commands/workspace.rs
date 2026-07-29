use tauri::State;
use crate::workspace::manager::{WorkspaceManager, Workspace};
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
pub fn workspace_delete_request(id: String, state: State<'_, AppState>, token_store: State<'_, crate::utils::token_store::SecureTokenStore>) -> Result<String, LedgerlineError> {
    log_info("Workspace", &format!("Delete request initiated for workspace {}", id));
    
    // Verify workspace exists
    let mgr = state.workspace_manager.lock().unwrap();
    let workspaces = mgr.list_workspaces().map_err(LedgerlineError::from)?;
    if !workspaces.iter().any(|w| w.id == id) {
        return Err(LedgerlineError::from(crate::workspace::manager::WorkspaceError::NotFound(id)));
    }

    let token = token_store.mint(crate::utils::token_store::ActionType::DeleteWorkspace { id });
    Ok(token)
}

#[tauri::command]
pub fn workspace_delete_confirm(id: String, token: String, state: State<'_, AppState>, token_store: State<'_, crate::utils::token_store::SecureTokenStore>) -> Result<(), LedgerlineError> {
    token_store.consume(&token, &crate::utils::token_store::ActionType::DeleteWorkspace { id: id.clone() })
        .map_err(LedgerlineError::from)?;
        
    let mgr = state.workspace_manager.lock().unwrap();
    mgr.delete_workspace(&id).map_err(LedgerlineError::from)
}
