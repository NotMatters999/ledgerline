use tauri::State;
use crate::commands::workspace::AppState;
use chrono::NaiveDate;
use duckdb::Connection;

fn get_workspace_conn(workspace_id: &str, state: &State<'_, AppState>) -> Result<Connection, String> {
    let mgr = state.workspace_manager.lock().unwrap();
    let workspaces = mgr.list_workspaces().map_err(|e| e.to_string())?;
    let ws = workspaces.iter().find(|w| w.id == workspace_id).ok_or("Workspace not found")?;
    crate::db::connection::open_connection(&ws.db_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn setting_set(_workspace_id: String, key: String, value: String, state: State<'_, AppState>) -> Result<(), String> {
    // Validation
    if key == "gross_margin" {
        if let Ok(v) = value.parse::<f64>() {
            if v < 0.0 || v > 100.0 {
                return Err("Gross margin must be between 0 and 100".into());
            }
        } else {
            return Err("Gross margin must be a number".into());
        }
    }

    let mut conn = get_workspace_conn(&_workspace_id, &state)?;
    
    // Atomic upsert: use a transaction so there is no gap between DELETE and INSERT
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM settings WHERE key = ?", [&key]).map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO settings (key, value) VALUES (?, ?)", [&key, &value]).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn setting_get(_workspace_id: String, key: String, state: State<'_, AppState>) -> Result<String, String> {
    let conn = get_workspace_conn(&_workspace_id, &state)?;
    
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ? LIMIT 1").map_err(|e| e.to_string())?;
    let mut rows = stmt.query([&key]).map_err(|e| e.to_string())?;
    
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let val: String = row.get(0).map_err(|e| e.to_string())?;
        Ok(val)
    } else {
        Err("Setting not found".into())
    }
}

#[tauri::command]
pub fn setting_get_f64(workspace_id: String, key: String, state: State<'_, AppState>) -> Result<f64, String> {
    let val_str = setting_get(workspace_id, key.clone(), state)?;
    val_str.parse::<f64>().map_err(|_| format!("Failed to parse setting '{}' as f64", key))
}

#[tauri::command]
pub fn marketing_spend_add(_workspace_id: String, period: String, amount: f64, _channel: String, state: State<'_, AppState>) -> Result<(), String> {
    // Validation
    if amount < 0.0 {
        return Err("Marketing spend amount cannot be negative".into());
    }
    // Validate period is a valid date (YYYY-MM-DD)
    if NaiveDate::parse_from_str(&period, "%Y-%m-%d").is_err() {
        return Err("Period must be a valid date in YYYY-MM-DD format".into());
    }

    let conn = get_workspace_conn(&_workspace_id, &state)?;
    
    let month_key = period.chars().take(7).collect::<String>(); // YYYY-MM

    conn.execute(
        "INSERT INTO monthly_assumptions (month, marketing_spend) 
         VALUES (?, ?)
         ON CONFLICT(month) DO UPDATE SET 
            marketing_spend = monthly_assumptions.marketing_spend + excluded.marketing_spend,
            updated_at = CURRENT_TIMESTAMP", 
        duckdb::params![month_key, amount]
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use duckdb::Connection;
    use crate::engines::ltv::calculate_ltv;
    use crate::engines::payback::calculate_payback;

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE mrr_log (customer_id VARCHAR, period DATE, mrr_amount DOUBLE, currency VARCHAR);
             CREATE TABLE monthly_assumptions (month VARCHAR PRIMARY KEY, marketing_spend DOUBLE, gross_margin DOUBLE, created_at TIMESTAMP, updated_at TIMESTAMP);
             CREATE TABLE settings (key VARCHAR, value VARCHAR);"
        ).unwrap();

        // Baseline: 3 customers, total 225 ending MRR (like the phase 5 test)
        conn.execute_batch(
            "INSERT INTO mrr_log VALUES ('A', '2024-03-01', 112.5, 'USD');
             INSERT INTO mrr_log VALUES ('B', '2024-03-01', 112.5, 'USD');
             "
        ).unwrap();
        // ARPA = 112.5. We need churn rate to compute LTV. 
        // Let's add a prior month so churn rate is computable.
        conn.execute_batch(
            "INSERT INTO mrr_log VALUES ('A', '2024-02-01', 112.5, 'USD');
             INSERT INTO mrr_log VALUES ('B', '2024-02-01', 112.5, 'USD');
             INSERT INTO mrr_log VALUES ('C', '2024-02-01', 100.0, 'USD');
             "
        ).unwrap();
        // Churn is C (1 customer). Beginning customers = 3. Churn rate = 1/3.
        conn
    }

    #[test]
    fn test_settings_persistence() {
        let conn = setup_db();
        // setting_set logic directly
        conn.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ["gross_margin", "0.8"]).unwrap();
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = 'gross_margin'").unwrap();
        let mut rows = stmt.query([]).unwrap();
        let val: String = rows.next().unwrap().unwrap().get(0).unwrap();
        assert_eq!(val, "0.8");
    }

    #[test]
    fn test_end_to_end_recomputation() {
        let conn = setup_db();
        
        // 1. Calculate LTV with default (1.0) margin if not set
        // Actually LTV engine defaults to 1.0 if setting missing
        let ltv1 = calculate_ltv(&conn).unwrap();
        let mar_ltv1 = &ltv1[1]; // Index 1 is Mar
        assert_eq!(mar_ltv1.arpa, 112.5);
        assert_eq!(mar_ltv1.churn_rate, 1.0/3.0);
        // LTV = (112.5 * 1.0) / (1/3) = 337.5
        assert_eq!(mar_ltv1.ltv, 337.5);

        // 2. Set Gross Margin to 0.50
        conn.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ["gross_margin", "0.50"]).unwrap();
        
        let ltv2 = calculate_ltv(&conn).unwrap();
        let mar_ltv2 = &ltv2[1];
        // LTV = (112.5 * 0.5) / (1/3) = 168.75
        assert_eq!(mar_ltv2.ltv, 168.75);

        // 3. Marketing Spend and Payback
        // Payback = CAC / (ARPA * margin)
        conn.execute("INSERT INTO monthly_assumptions (month, marketing_spend) VALUES ('2024-03', 500.0)").unwrap();
        
        // Wait, Payback engine CAC calculation for March:
        // Spends in March: 500. New customers in March: 0? 
        // In our setup, no new customers in March. CAC is 0. Payback will be 0.
        // Let's add a new customer in March so CAC is computed.
        conn.execute("INSERT INTO mrr_log VALUES ('D', '2024-03-01', 50.0, 'USD')").unwrap();

        let payback = calculate_payback(&conn).unwrap();
        let mar_payback = &payback[1];
        // CAC = 500 / 1 new = 500.
        // ARPA = (112.5*2 + 50) / 3 = 275 / 3 = 91.666...
        // Margin = 0.50.
        // MRR contribution = ARPA * Margin = 45.833...
        // Payback months = CAC / MRR contrib = 500 / 45.833... = 10.909...
        assert!((mar_payback.payback_months - 10.909090909090908).abs() < 1e-5);
    }
}
