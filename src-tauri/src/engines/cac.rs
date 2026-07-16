use duckdb::Connection;
use serde::Serialize;
use crate::engines::mrr::calculate_mrr;
use std::collections::HashMap;

#[derive(Debug, Serialize)]
pub struct CacMovement {
    pub month: String,
    pub marketing_spend: f64,
    pub cac: f64,
}

pub fn calculate_cac(conn: &Connection) -> Result<Vec<CacMovement>, duckdb::Error> {
    let mrr_data = calculate_mrr(conn)?;

    let mut stmt = conn.prepare(
        "SELECT date_trunc('month', period)::DATE as month, SUM(amount) as spend 
         FROM marketing_spend 
         GROUP BY month"
    )?;
    
    let mut rows = stmt.query([])?;
    let mut spend_by_month = HashMap::new();
    
    while let Some(row) = rows.next()? {
        let month: chrono::NaiveDate = row.get(0)?;
        let spend: f64 = row.get(1)?;
        spend_by_month.insert(month.format("%Y-%m-%d").to_string(), spend);
    }

    let mut cac_data = Vec::new();

    for m in mrr_data {
        let spend = spend_by_month.get(&m.month).cloned().unwrap_or(0.0);
        let mut cac = 0.0;
        
        if m.new_customers > 0 {
            cac = spend / m.new_customers as f64;
        }

        cac_data.push(CacMovement {
            month: m.month,
            marketing_spend: spend,
            cac,
        });
    }

    Ok(cac_data)
}
