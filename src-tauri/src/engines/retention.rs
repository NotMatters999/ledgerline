use duckdb::Connection;
use serde::Serialize;
use crate::engines::mrr::calculate_mrr;

#[derive(Debug, Serialize)]
pub struct RetentionMovement {
    pub month: String,
    pub grr: f64,
    pub nrr: f64,
    pub logo_retention: f64,
}

pub fn calculate_retention(conn: &Connection) -> Result<Vec<RetentionMovement>, duckdb::Error> {
    let mrr_data = calculate_mrr(conn)?;
    
    let mut retention_data = Vec::new();

    for m in mrr_data {
        let mut grr = 0.0;
        let mut nrr = 0.0;
        let mut logo = 0.0;

        if m.beginning > 0.0 {
            // GRR = (Beginning - Churn - Contraction) / Beginning
            // Note: m.churn and m.contraction are positive numbers in our struct
            let retained_mrr = m.beginning - m.churn - m.contraction;
            grr = (retained_mrr / m.beginning).max(0.0).min(1.0); // Bounded to 100%

            // NRR = (Beginning + Expansion - Contraction - Churn) / Beginning
            let net_retained_mrr = m.beginning + m.expansion - m.contraction - m.churn;
            nrr = (net_retained_mrr / m.beginning).max(0.0);
        }

        if m.beginning_customers > 0 {
            let retained_customers = m.beginning_customers.saturating_sub(m.churned_customers);
            logo = retained_customers as f64 / m.beginning_customers as f64;
        }

        retention_data.push(RetentionMovement {
            month: m.month,
            grr,
            nrr,
            logo_retention: logo,
        });
    }

    Ok(retention_data)
}
