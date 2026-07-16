use tauri::State;
use crate::commands::workspace::AppState;
use crate::engines::{mrr::*, arr::*, retention::*, ltv::*, cac::*, payback::*, forecast::*, cohort::*};

fn get_workspace_conn(workspace_id: &str, state: &State<'_, AppState>) -> Result<duckdb::Connection, String> {
    let mgr = state.workspace_manager.lock().unwrap();
    let workspaces = mgr.list_workspaces().map_err(|e| e.to_string())?;
    let ws = workspaces.iter().find(|w| w.id == workspace_id).ok_or("Workspace not found")?;
    crate::db::connection::open_connection(&ws.db_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn mrr_get(_workspace_id: String, state: State<'_, AppState>) -> Result<Vec<MrrMovement>, String> {
    let conn = get_workspace_conn(&_workspace_id, &state)?;
    calculate_mrr(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn arr_get(_workspace_id: String, state: State<'_, AppState>) -> Result<Vec<ArrMovement>, String> {
    let conn = get_workspace_conn(&_workspace_id, &state)?;
    calculate_arr(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn retention_get(_workspace_id: String, state: State<'_, AppState>) -> Result<Vec<RetentionMovement>, String> {
    let conn = get_workspace_conn(&_workspace_id, &state)?;
    calculate_retention(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ltv_get(_workspace_id: String, state: State<'_, AppState>) -> Result<Vec<LtvMovement>, String> {
    let conn = get_workspace_conn(&_workspace_id, &state)?;
    calculate_ltv(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cac_get(_workspace_id: String, state: State<'_, AppState>) -> Result<Vec<CacMovement>, String> {
    let conn = get_workspace_conn(&_workspace_id, &state)?;
    calculate_cac(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn payback_get(_workspace_id: String, state: State<'_, AppState>) -> Result<Vec<PaybackMovement>, String> {
    let conn = get_workspace_conn(&_workspace_id, &state)?;
    calculate_payback(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn forecast_get(_workspace_id: String, params: ForecastParams, state: State<'_, AppState>) -> Result<Vec<ForecastMovement>, String> {
    let conn = get_workspace_conn(&_workspace_id, &state)?;
    calculate_forecast(&conn, &params).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cohort_get(_workspace_id: String, state: State<'_, AppState>) -> Result<CohortData, String> {
    let conn = get_workspace_conn(&_workspace_id, &state)?;
    calculate_cohorts(&conn).map_err(|e| e.to_string())
}
