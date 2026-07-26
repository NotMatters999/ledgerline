use duckdb::Connection;
use serde::Serialize;
use crate::engines::ltv::calculate_ltv;
use crate::engines::cac::calculate_cac;

#[derive(Debug, Serialize)]
pub struct PaybackMovement {
    pub month: String,
    pub payback_months: Option<f64>,
}

pub fn calculate_payback(conn: &Connection) -> Result<Vec<PaybackMovement>, duckdb::Error> {
    let ltv_data = calculate_ltv(conn)?;
    let cac_data = calculate_cac(conn)?;

    let mut payback_data = Vec::new();

    for (ltv_m, cac_m) in ltv_data.iter().zip(cac_data.iter()) {
        let mut payback = None;
        let denominator = ltv_m.arpa * ltv_m.gross_margin;
        
        if denominator > 0.0 {
            if let Some(cac) = cac_m.cac {
                payback = Some(cac / denominator);
            }
        }

        payback_data.push(PaybackMovement {
            month: ltv_m.month.clone(),
            payback_months: payback,
        });
    }

    Ok(payback_data)
}
