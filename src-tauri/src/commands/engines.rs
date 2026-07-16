use tauri::State;
use crate::commands::workspace::AppState;
use crate::engines::{mrr::*, arr::*, retention::*, ltv::*, cac::*, payback::*, forecast::*, cohort::*};

#[tauri::command]
pub fn mrr_get(_workspace_id: String, state: State<'_, AppState>) -> Result<Vec<MrrMovement>, String> {
    let mut manager = state.manager.lock().unwrap();
    let conn = manager.get_connection().map_err(|e| e.to_string())?;
    calculate_mrr(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn arr_get(_workspace_id: String, state: State<'_, AppState>) -> Result<Vec<ArrMovement>, String> {
    let mut manager = state.manager.lock().unwrap();
    let conn = manager.get_connection().map_err(|e| e.to_string())?;
    calculate_arr(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn retention_get(_workspace_id: String, state: State<'_, AppState>) -> Result<Vec<RetentionMovement>, String> {
    let mut manager = state.manager.lock().unwrap();
    let conn = manager.get_connection().map_err(|e| e.to_string())?;
    calculate_retention(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ltv_get(_workspace_id: String, state: State<'_, AppState>) -> Result<Vec<LtvMovement>, String> {
    let mut manager = state.manager.lock().unwrap();
    let conn = manager.get_connection().map_err(|e| e.to_string())?;
    calculate_ltv(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cac_get(_workspace_id: String, state: State<'_, AppState>) -> Result<Vec<CacMovement>, String> {
    let mut manager = state.manager.lock().unwrap();
    let conn = manager.get_connection().map_err(|e| e.to_string())?;
    calculate_cac(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn payback_get(_workspace_id: String, state: State<'_, AppState>) -> Result<Vec<PaybackMovement>, String> {
    let mut manager = state.manager.lock().unwrap();
    let conn = manager.get_connection().map_err(|e| e.to_string())?;
    calculate_payback(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn forecast_get(_workspace_id: String, params: ForecastParams, state: State<'_, AppState>) -> Result<Vec<ForecastMovement>, String> {
    let mut manager = state.manager.lock().unwrap();
    let conn = manager.get_connection().map_err(|e| e.to_string())?;
    calculate_forecast(&conn, &params).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cohort_get(_workspace_id: String, state: State<'_, AppState>) -> Result<CohortData, String> {
    let mut manager = state.manager.lock().unwrap();
    let conn = manager.get_connection().map_err(|e| e.to_string())?;
    calculate_cohorts(&conn).map_err(|e| e.to_string())
}
