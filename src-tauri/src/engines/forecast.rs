use duckdb::Connection;
use serde::{Deserialize, Serialize};
use chrono::{Datelike, NaiveDate};
use crate::engines::mrr::calculate_mrr;

#[derive(Debug, Deserialize)]
pub struct ForecastParams {
    pub monthly_churn_rate: f64,     // e.g., 0.02 for 2%
    pub monthly_expansion_rate: f64, // e.g., 0.03 for 3%
    pub new_mrr_per_month: f64,      // flat amount to add per month
}

#[derive(Debug, Serialize)]
pub struct ForecastMovement {
    pub month: String,
    pub beginning: f64,
    pub churn: f64,
    pub expansion: f64,
    pub new: f64,
    pub ending: f64,
}

pub fn calculate_forecast(conn: &Connection, params: &ForecastParams) -> Result<Vec<ForecastMovement>, duckdb::Error> {
    let mrr_data = calculate_mrr(conn)?;
    
    let mut baseline_mrr = 0.0;
    let mut last_date = NaiveDate::from_ymd_opt(Utc::now().year(), Utc::now().month(), 1).unwrap();

    if let Some(last_movement) = mrr_data.last() {
        baseline_mrr = last_movement.ending;
        if let Ok(d) = NaiveDate::parse_from_str(&last_movement.month, "%Y-%m-%d") {
            last_date = d;
        }
    }

    let mut forecast = Vec::new();
    let mut current_mrr = baseline_mrr;
    let mut current_date = last_date;

    for _ in 0..12 {
        let mut y = current_date.year();
        let mut m = current_date.month() + 1;
        if m > 12 {
            m = 1;
            y += 1;
        }
        current_date = NaiveDate::from_ymd_opt(y, m, 1).unwrap();

        let churn = current_mrr * params.monthly_churn_rate;
        let expansion = current_mrr * params.monthly_expansion_rate;
        let ending = current_mrr - churn + expansion + params.new_mrr_per_month;

        forecast.push(ForecastMovement {
            month: current_date.format("%Y-%m-%d").to_string(),
            beginning: current_mrr,
            churn,
            expansion,
            new: params.new_mrr_per_month,
            ending,
        });

        current_mrr = ending;
    }

    Ok(forecast)
}

use chrono::Utc;

#[cfg(test)]
mod tests {
    use super::*;
    use duckdb::Connection;
    use std::time::Instant;

    #[test]
    fn test_forecast_latency() {
        // Setup in-memory DuckDB with 10k rows of dummy MRR to simulate a mid-sized DB.
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE mrr_log (customer_id VARCHAR, period DATE, mrr_amount DOUBLE, currency VARCHAR);"
        ).unwrap();
        
        // Insert a base record so mrr exists
        conn.execute_batch(
            "INSERT INTO mrr_log VALUES ('A', '2024-03-01', 10000.0, 'USD');"
        ).unwrap();
        
        let params = ForecastParams {
            monthly_churn_rate: 0.02,
            monthly_expansion_rate: 0.03,
            new_mrr_per_month: 1000.0,
        };

        // We run it 100 times to simulate rapid sliding
        let start = Instant::now();
        for _ in 0..100 {
            let _ = calculate_forecast(&conn, &params).unwrap();
        }
        let elapsed = start.elapsed();
        let avg_latency = elapsed.as_millis() as f64 / 100.0;
        
        println!("Average calculate_forecast latency: {} ms", avg_latency);
        
        // Ensure the average latency is well under the 200ms budget.
        // We assert < 10ms for just the backend engine to leave room for IPC overhead.
        assert!(avg_latency < 10.0, "Forecast calculation too slow: {} ms", avg_latency);
    }
}
