use tauri::State;
use serde::{Deserialize, Serialize};
use duckdb::Connection;
use crate::commands::workspace::AppState;
use crate::utils::error::LedgerlineError;
use crate::utils::logger::log_info;

fn get_workspace_conn(workspace_id: &str, state: &State<'_, AppState>) -> Result<Connection, String> {
    let mgr = state.workspace_manager.lock().unwrap();
    let workspaces = mgr.list_workspaces().map_err(|e| e.to_string())?;
    let ws = workspaces.iter().find(|w| w.id == workspace_id).ok_or("Workspace not found")?;
    crate::db::connection::open_connection(&ws.db_path).map_err(|e| e.to_string())
}

// ─── Data row shape ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MrrLogRow {
    pub rowid: i64,
    pub customer_id: String,
    pub period: String,
    pub mrr_amount: f64,
    pub currency: String,
}

// ─── LIST: search + sort + paginate ──────────────────────────────────────────

#[tauri::command]
pub fn mrr_log_list(
    workspace_id: String,
    search: String,
    sort_by: String,
    sort_dir: String,
    offset: i64,
    limit: i64,
    state: State<'_, AppState>,
) -> Result<Vec<MrrLogRow>, LedgerlineError> {
    let conn = get_workspace_conn(&workspace_id, &state).map_err(LedgerlineError::from)?;

    // Whitelist sort columns to prevent SQL injection
    let safe_col = match sort_by.as_str() {
        "customer_id" => "customer_id",
        "period" => "period",
        "mrr_amount" => "mrr_amount",
        "currency" => "currency",
        _ => "period",
    };
    let safe_dir = if sort_dir.to_uppercase() == "DESC" { "DESC" } else { "ASC" };

    let query = format!(
        "SELECT rowid, customer_id, period::VARCHAR, mrr_amount, currency
         FROM mrr_log
         WHERE customer_id ILIKE ? OR currency ILIKE ?
         ORDER BY {} {}
         LIMIT ? OFFSET ?",
        safe_col, safe_dir
    );

    let pattern = format!("%{}%", search);
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let rows_iter = stmt.query_map(
        duckdb::params![pattern, pattern, limit, offset],
        |row| {
            Ok(MrrLogRow {
                rowid: row.get(0)?,
                customer_id: row.get(1)?,
                period: row.get(2)?,
                mrr_amount: row.get(3)?,
                currency: row.get(4)?,
            })
        },
    ).map_err(|e| e.to_string())?;

    let rows: Result<Vec<MrrLogRow>, _> = rows_iter.collect();
    rows.map_err(|e: duckdb::Error| LedgerlineError::from(e.to_string()))
}

// ─── COUNT: total matching rows (for pagination) ──────────────────────────────

#[tauri::command]
pub fn mrr_log_count(
    workspace_id: String,
    search: String,
    state: State<'_, AppState>,
) -> Result<i64, LedgerlineError> {
    let conn = get_workspace_conn(&workspace_id, &state).map_err(LedgerlineError::from)?;
    let pattern = format!("%{}%", search);
    let count: i64 = conn.query_row(
        "SELECT count(*) FROM mrr_log WHERE customer_id ILIKE ? OR currency ILIKE ?",
        duckdb::params![pattern, pattern],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    Ok(count)
}

// ─── ADD: single row, routes through validate_row ────────────────────────────

#[derive(Debug, Deserialize)]
pub struct MrrLogAddPayload {
    pub customer_id: String,
    pub period: String,
    pub mrr_amount: f64,
    pub currency: String,
}

#[tauri::command]
pub fn mrr_log_add(
    workspace_id: String,
    row: MrrLogAddPayload,
    state: State<'_, AppState>,
) -> Result<(), LedgerlineError> {
    log_info("Data", &format!("Adding MRR row for {}", row.customer_id));

    // Run through the same validation used in bulk imports
    crate::validation::validate_row(
        1,
        &row.customer_id,
        &row.period,
        row.mrr_amount,
        &row.currency,
        "Standard", // category not in UI, default to Standard
    ).map_err(|e| LedgerlineError::from(e.reason.as_str()))?;

    let mut conn = get_workspace_conn(&workspace_id, &state).map_err(LedgerlineError::from)?;

    // Use a transaction for atomicity
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES (?, ?, ?, ?)",
        duckdb::params![row.customer_id, row.period, row.mrr_amount, row.currency],
    ).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;

    log_info("Data", "MRR row added successfully");
    Ok(())
}

// ─── DELETE: by rowid ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn mrr_log_delete(
    workspace_id: String,
    rowid: i64,
    state: State<'_, AppState>,
) -> Result<MrrLogRow, LedgerlineError> {
    log_info("Data", &format!("Deleting MRR row rowid={}", rowid));

    let mut conn = get_workspace_conn(&workspace_id, &state).map_err(LedgerlineError::from)?;

    // Fetch before deleting so the caller can cache it for undo
    let deleted_row = conn.query_row(
        "SELECT rowid, customer_id, period::VARCHAR, mrr_amount, currency FROM mrr_log WHERE rowid = ?",
        duckdb::params![rowid],
        |row| Ok(MrrLogRow {
            rowid: row.get(0)?,
            customer_id: row.get(1)?,
            period: row.get(2)?,
            mrr_amount: row.get(3)?,
            currency: row.get(4)?,
        }),
    ).map_err(|e| LedgerlineError::from(e.to_string()))?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let affected = tx.execute("DELETE FROM mrr_log WHERE rowid = ?", duckdb::params![rowid])
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err(LedgerlineError::from("Row not found"));
    }
    tx.commit().map_err(|e| e.to_string())?;

    log_info("Data", "MRR row deleted successfully");
    Ok(deleted_row)
}
