use duckdb::Connection;
use serde::Serialize;
use crate::engines::mrr::calculate_mrr;
use std::collections::HashMap;

#[derive(Debug, Serialize)]
pub struct CacMovement {
    pub month: String,
    pub marketing_spend: f64,
    pub cac: Option<f64>,
}

pub fn calculate_cac(conn: &Connection) -> Result<Vec<CacMovement>, duckdb::Error> {
    let mrr_data = calculate_mrr(conn)?;

    let mut stmt = conn.prepare(
        "SELECT month, SUM(marketing_spend) as spend 
         FROM monthly_assumptions 
         WHERE marketing_spend IS NOT NULL
         GROUP BY month"
    )?;
    
    let mut rows = stmt.query([])?;
    let mut spend_by_month = HashMap::new();
    
    while let Some(row) = rows.next()? {
        let month: String = row.get(0)?; // "YYYY-MM"
        let spend: f64 = row.get(1)?;
        spend_by_month.insert(month, spend);
    }

    let mut cac_data = Vec::new();

    for m in mrr_data {
        let month_key = m.month.chars().take(7).collect::<String>(); // YYYY-MM
        let spend = spend_by_month.get(&month_key).cloned().unwrap_or(0.0);
        let mut cac = None;
        
        if m.new_customers > 0 {
            cac = Some(spend / m.new_customers as f64);
        }

        cac_data.push(CacMovement {
            month: m.month,
            marketing_spend: spend,
            cac,
        });
    }

    Ok(cac_data)
}
