use duckdb::Connection;
use serde::Serialize;
use crate::engines::mrr::calculate_mrr;
use std::collections::HashMap;

#[derive(Debug, Serialize)]
pub struct LtvMovement {
    pub month: String,
    pub ltv: Option<f64>,
    pub arpa: f64,
    pub gross_margin: f64,
    pub churn_rate: f64,
}

pub fn calculate_ltv(conn: &Connection) -> Result<Vec<LtvMovement>, duckdb::Error> {
    let mrr_data = calculate_mrr(conn)?;
    
    // Fetch monthly gross margins
    let mut stmt = conn.prepare("SELECT month, gross_margin FROM monthly_assumptions WHERE gross_margin IS NOT NULL")?;
    let mut rows = stmt.query([])?;
    let mut margin_by_month: HashMap<String, f64> = HashMap::new();
    while let Some(row) = rows.next()? {
        let month: String = row.get(0)?;
        let margin: f64 = row.get(1)?;
        margin_by_month.insert(month, margin);
    }

    // Also get the global fallback gross_margin from settings just in case
    let global_margin: f64 = conn.query_row("SELECT value FROM settings WHERE key = 'gross_margin'", [], |row| {
        let val: String = row.get(0)?;
        Ok(val)
    })
    .ok()
    .and_then(|s| s.parse::<f64>().ok())
    .unwrap_or(1.0);

    let mut ltv_data = Vec::new();

    for m in mrr_data {
        let month_key = m.month.chars().take(7).collect::<String>(); // YYYY-MM
        let gross_margin = margin_by_month.get(&month_key).copied().unwrap_or(global_margin);

        let mut arpa = 0.0;
        let mut churn_rate = 0.0;
        let mut ltv = None;

        if m.ending_customers > 0 {
            arpa = m.ending / m.ending_customers as f64;
        }

        if m.beginning_customers > 0 {
            churn_rate = m.churned_customers as f64 / m.beginning_customers as f64;
        }

        if churn_rate > 0.0 {
            ltv = Some((arpa * gross_margin) / churn_rate);
        }

        ltv_data.push(LtvMovement {
            month: m.month,
            ltv,
            arpa,
            gross_margin,
            churn_rate,
        });
    }

    Ok(ltv_data)
}
