use duckdb::Connection;
use serde::Serialize;
use crate::engines::mrr::calculate_mrr;

#[derive(Debug, Serialize)]
pub struct LtvMovement {
    pub month: String,
    pub ltv: f64,
    pub arpa: f64,
    pub gross_margin: f64,
    pub churn_rate: f64,
}

fn get_gross_margin(conn: &Connection) -> f64 {
    conn.query_row("SELECT value FROM settings WHERE key = 'gross_margin'", [], |row| {
        let val: String = row.get(0)?;
        Ok(val)
    })
    .ok()
    .and_then(|s| s.parse::<f64>().ok())
    .unwrap_or(1.0) // Default to 100% margin if not set
}

pub fn calculate_ltv(conn: &Connection) -> Result<Vec<LtvMovement>, duckdb::Error> {
    let mrr_data = calculate_mrr(conn)?;
    let gross_margin = get_gross_margin(conn);
    
    let mut ltv_data = Vec::new();

    for m in mrr_data {
        let mut arpa = 0.0;
        let mut churn_rate = 0.0;
        let mut ltv = 0.0;

        if m.ending_customers > 0 {
            arpa = m.ending / m.ending_customers as f64;
        }

        if m.beginning_customers > 0 {
            churn_rate = m.churned_customers as f64 / m.beginning_customers as f64;
        }

        if churn_rate > 0.0 {
            ltv = (arpa * gross_margin) / churn_rate;
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
