use duckdb::Connection;
use serde::Serialize;
use crate::engines::mrr::calculate_mrr;

#[derive(Debug, Serialize)]
pub struct ArrMovement {
    pub month: String,
    pub arr: f64,
}

pub fn calculate_arr(conn: &Connection) -> Result<Vec<ArrMovement>, duckdb::Error> {
    let mrr_data = calculate_mrr(conn)?;
    
    let arr_data = mrr_data.into_iter().map(|m| ArrMovement {
        month: m.month,
        arr: m.ending * 12.0,
    }).collect();

    Ok(arr_data)
}
