use duckdb::Connection;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use chrono::{NaiveDate, Datelike};

#[derive(Debug, Serialize, Clone, Default)]
pub struct MrrMovement {
    pub month: String,
    pub beginning: f64,
    pub new: f64,
    pub expansion: f64,
    pub reactivation: f64,
    pub contraction: f64,
    pub churn: f64,
    pub net_new: f64,
    pub ending: f64,
    // Logo counts
    pub beginning_customers: usize,
    pub new_customers: usize,
    pub churned_customers: usize,
    pub ending_customers: usize,
}

pub fn calculate_mrr(conn: &Connection) -> Result<Vec<MrrMovement>, duckdb::Error> {
    let mut stmt = conn.prepare(
        "SELECT customer_id, 
                date_trunc('month', period)::DATE as month_start, 
                SUM(mrr_amount) as mrr 
         FROM mrr_log 
         GROUP BY customer_id, month_start 
         ORDER BY month_start, customer_id"
    )?;

    let mut rows = stmt.query([])?;
    
    // month_start -> customer_id -> mrr
    let mut data_by_month: std::collections::BTreeMap<NaiveDate, HashMap<String, f64>> = std::collections::BTreeMap::new();
    let mut all_customers = HashSet::new();

    while let Some(row) = rows.next()? {
        let cust: String = row.get(0)?;
        let month: NaiveDate = row.get(1)?;
        let mrr: f64 = row.get(2)?;
        
        all_customers.insert(cust.clone());
        data_by_month.entry(month).or_default().insert(cust, mrr);
    }

    if data_by_month.is_empty() {
        return Ok(vec![]);
    }

    // Generate continuous sequence of months
    let min_month = *data_by_month.keys().next().unwrap();
    let max_month = *data_by_month.keys().last().unwrap();
    
    let mut current = min_month;
    let mut months = Vec::new();
    while current <= max_month {
        months.push(current);
        let mut y = current.year();
        let mut m = current.month() + 1;
        if m > 12 {
            m = 1;
            y += 1;
        }
        current = NaiveDate::from_ymd_opt(y, m, 1).unwrap();
    }

    let mut results = Vec::new();
    let mut prev_mrr_state: HashMap<String, f64> = HashMap::new();
    let mut last_active_month: HashMap<String, NaiveDate> = HashMap::new();

    for month in months {
        let mut movement = MrrMovement {
            month: month.format("%Y-%m-%d").to_string(),
            ..Default::default()
        };

        let current_month_data = data_by_month.get(&month).cloned().unwrap_or_default();
        let mut next_mrr_state = HashMap::new();

        let mut customers_to_check = prev_mrr_state.keys().cloned().collect::<HashSet<_>>();
        customers_to_check.extend(current_month_data.keys().cloned());

        for cust in customers_to_check {
            let prev = prev_mrr_state.get(&cust).cloned().unwrap_or(0.0);
            let curr = current_month_data.get(&cust).cloned().unwrap_or(0.0);

            movement.beginning += prev;
            movement.ending += curr;

            if curr > 0.0 {
                next_mrr_state.insert(cust.clone(), curr);
                movement.ending_customers += 1;
                
                if prev == 0.0 {
                    if let Some(last_active) = last_active_month.get(&cust) {
                        // Calculate month difference
                        let diff_years = month.year() - last_active.year();
                        let diff_months = diff_years * 12 + month.month() as i32 - last_active.month() as i32;
                        
                        // If diff_months is 2, it means 1 full calendar month gap (e.g. Dec to Feb)
                        if diff_months <= 2 {
                            movement.expansion += curr;
                            movement.new_customers += 1; // Need to add logo back since it was removed during churn
                        } else {
                            movement.reactivation += curr;
                            movement.new_customers += 1;
                        }
                    } else {
                        movement.new += curr;
                        movement.new_customers += 1;
                    }
                } else if curr > prev {
                    movement.expansion += curr - prev;
                } else if curr < prev {
                    movement.contraction += prev - curr; 
                }
                
                last_active_month.insert(cust.clone(), month);
            } else if prev > 0.0 {
                movement.churn += prev; 
                movement.churned_customers += 1;
            }
            
            if prev > 0.0 {
                movement.beginning_customers += 1;
            }
        }

        movement.net_new = movement.new + movement.expansion + movement.reactivation - movement.contraction - movement.churn;
        
        results.push(movement);
        prev_mrr_state = next_mrr_state;
    }

    Ok(results)
}
