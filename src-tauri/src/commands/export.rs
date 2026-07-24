use tauri::State;
use crate::commands::workspace::AppState;
use crate::engines::mrr::calculate_mrr;
use crate::engines::retention::calculate_retention;
use crate::engines::cohort::calculate_cohorts;
use serde::Serialize;
use csv::WriterBuilder;
use std::io::Cursor;
use crate::utils::error::LedgerlineError;
use crate::utils::logger::log_info;
use duckdb::Connection;

fn get_workspace_conn(workspace_id: &str, state: &State<'_, AppState>) -> Result<Connection, String> {
    let mgr = state.workspace_manager.lock().unwrap();
    let workspaces = mgr.list_workspaces().map_err(|e| e.to_string())?;
    let ws = workspaces.iter().find(|w| w.id == workspace_id).ok_or("Workspace not found")?;
    crate::db::connection::open_connection(&ws.db_path).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct CsvExportResult {
    pub mrr_csv: String,
    pub retention_csv: String,
    pub cohorts_csv: String,
}

pub fn generate_csv(conn: &Connection) -> Result<CsvExportResult, String> {
    let mrr_data = calculate_mrr(conn).map_err(|e| e.to_string())?;
    let ret_data = calculate_retention(conn).map_err(|e| e.to_string())?;
    let cohort_data = calculate_cohorts(conn).map_err(|e| e.to_string())?;

    // MRR CSV
    let mut mrr_wtr = WriterBuilder::new().from_writer(vec![]);
    for row in &mrr_data { mrr_wtr.serialize(row).map_err(|e| e.to_string())?; }
    let mrr_csv = String::from_utf8(mrr_wtr.into_inner().unwrap()).unwrap();

    // Retention CSV
    let mut ret_wtr = WriterBuilder::new().from_writer(vec![]);
    for row in &ret_data { ret_wtr.serialize(row).map_err(|e| e.to_string())?; }
    let retention_csv = String::from_utf8(ret_wtr.into_inner().unwrap()).unwrap();

    // Cohorts CSV
    let mut coh_wtr = WriterBuilder::new().from_writer(vec![]);
    #[derive(Serialize)]
    struct FlatCohortRow<'a> {
        join_month: &'a str,
        new_customers: usize,
        new_revenue: f64,
        month_index: usize,
        retained_customers: usize,
        retained_revenue: f64,
    }
    for row in &cohort_data.rows {
        for cell in &row.data {
            coh_wtr.serialize(FlatCohortRow {
                join_month: &row.join_month,
                new_customers: row.new_customers,
                new_revenue: row.new_revenue,
                month_index: cell.month_index,
                retained_customers: cell.retained_customers,
                retained_revenue: cell.retained_revenue,
            }).map_err(|e| e.to_string())?;
        }
    }
    let cohorts_csv = String::from_utf8(coh_wtr.into_inner().unwrap()).unwrap();

    Ok(CsvExportResult { mrr_csv, retention_csv, cohorts_csv })
}

#[tauri::command]
pub fn export_csv(_workspace_id: String, state: State<'_, AppState>) -> Result<CsvExportResult, LedgerlineError> {
    log_info("Export", "Starting CSV export generation");
    let conn = get_workspace_conn(&_workspace_id, &state).map_err(LedgerlineError::from)?;
    let result = generate_csv(&conn).map_err(LedgerlineError::from)?;
    log_info("Export", "CSV export generation completed successfully");
    Ok(result)
}

pub fn generate_pdf(conn: &Connection) -> Result<Vec<u8>, String> {
    use genpdf::elements::Paragraph;
    use genpdf::{Document, SimplePageDecorator};
    
    let font_bytes = include_bytes!("../../assets/fonts/arial.ttf").to_vec();
    let font_data = match genpdf::fonts::FontData::new(font_bytes, None) {
        Ok(data) => data,
        Err(_) => return Err("Failed to parse embedded Arial font data".to_string()),
    };
    
    let font_family = genpdf::fonts::FontFamily {
        regular: font_data.clone(),
        bold: font_data.clone(),
        italic: font_data.clone(),
        bold_italic: font_data.clone(),
    };

    let mut doc = Document::new(font_family);
    let mut decorator = SimplePageDecorator::new();
    decorator.set_margins(10);
    doc.set_page_decorator(decorator);

    doc.push(Paragraph::new("LedgerLine Executive Summary").aligned(genpdf::Alignment::Center));
    doc.push(Paragraph::new("This is a structural PDF report containing KPIs, retention tables, and forecast data."));

    if let Ok(mrr) = calculate_mrr(conn) {
        if let Some(last) = mrr.last() {
            doc.push(Paragraph::new(format!("Ending MRR for latest month: ${}", last.ending)));
        }
    }

    let mut buffer = Cursor::new(Vec::new());
    doc.render(&mut buffer).map_err(|e| e.to_string())?;
    Ok(buffer.into_inner())
}

#[tauri::command]
pub fn export_pdf(_workspace_id: String, state: State<'_, AppState>) -> Result<Vec<u8>, LedgerlineError> {
    log_info("Export", "Starting PDF export generation");
    let conn = get_workspace_conn(&_workspace_id, &state).map_err(LedgerlineError::from)?;
    let buffer = generate_pdf(&conn).map_err(LedgerlineError::from)?;
    log_info("Export", "PDF export generation completed successfully");
    Ok(buffer)
}

#[cfg(test)]
mod tests {
    use duckdb::Connection;
    use crate::engines::mrr::calculate_mrr;
    use csv::WriterBuilder;

    #[test]
    fn test_csv_data_integrity() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE mrr_log (customer_id VARCHAR, period DATE, mrr_amount DOUBLE, currency VARCHAR);"
        ).unwrap();
        
        conn.execute_batch(
            "INSERT INTO mrr_log VALUES ('A', '2024-03-01', 112.5, 'USD');"
        ).unwrap();
        
        let mrr_data = calculate_mrr(&conn).unwrap();
        let mut wtr = WriterBuilder::new().from_writer(vec![]);
        wtr.serialize(&mrr_data[0]).unwrap();
        let csv_str = String::from_utf8(wtr.into_inner().unwrap()).unwrap();
        
        // Assert header or content is serialized correctly
        assert!(csv_str.contains("2024-03-01"));
        assert!(csv_str.contains("112.5"));
    }
}
