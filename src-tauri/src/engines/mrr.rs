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
    // LEFT JOIN exchange_rates so that:
    //   - currencies with a configured rate are converted to the base currency
    //   - currencies with no row in exchange_rates default to rate 1.0 (pass-through)
    // This is backwards-compatible: single-currency workspaces see no change.
    let mut stmt = conn.prepare(
        "SELECT m.customer_id,
                date_trunc('month', m.period)::DATE as month_start,
                SUM(m.mrr_amount * COALESCE(er.rate_to_base, 1.0)) as mrr
         FROM mrr_log m
         LEFT JOIN exchange_rates er ON er.currency = m.currency
         GROUP BY m.customer_id, month_start
         ORDER BY month_start, m.customer_id"
    )?;

    let mut rows = stmt.query([])?;
    
    // month_start -> customer_id -> mrr
    let mut data_by_month: std::collections::BTreeMap<NaiveDate, HashMap<String, f64>> = std::collections::BTreeMap::new();
    while let Some(row) = rows.next()? {
        let cust: String = row.get(0)?;
        let month: NaiveDate = row.get(1)?;
        let mrr: f64 = row.get(2)?;
        
        data_by_month.entry(month).or_default().insert(cust, mrr);
    }

    if data_by_month.is_empty() {
        return Ok(vec![]);
    }

    // Generate continuous sequence of months
    let min_month = data_by_month.keys().next().copied().unwrap();
    let max_month = data_by_month.keys().last().copied().unwrap();
    
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
            let prev = prev_mrr_state.get(&cust).copied().unwrap_or(0.0);
            let curr = current_month_data.get(&cust).copied().unwrap_or(0.0);

            movement.beginning += prev;
            movement.ending += curr;

            if curr > 0.0 {
                next_mrr_state.insert(cust.clone(), curr);
                movement.ending_customers += 1;
                
                if let Some(&last_active) = last_active_month.get(&cust) {
                    let gap_months = (month.year() - last_active.year()) * 12 + (month.month() as i32 - last_active.month() as i32);
                    
                    if gap_months == 1 {
                        if curr > prev {
                            movement.expansion += curr - prev;
                        } else if curr < prev {
                            movement.contraction += prev - curr; 
                        }
                    } else if gap_months >= 2 {
                        movement.reactivation += curr;
                    }
                } else {
                    movement.new += curr;
                    movement.new_customers += 1;
                }
                
                last_active_month.insert(cust.clone(), month);
            } else if prev > 0.0 {
                movement.churn += prev; 
                movement.churned_customers += 1;
                // Do NOT update `last_active_month` to the churn month here.
                // `last_active_month` should represent the last month the customer
                // had positive MRR. Overwriting it on churn causes reactivation
                // detection to see a shorter absence than intended.
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

/// Returns the distinct currency codes that appear in `mrr_log` but have no
/// row in `exchange_rates`.  An empty vec means every currency is covered
/// (or the workspace only has one currency and no conversion is needed).
/// The frontend uses this to show a warning banner.
pub fn currencies_without_rates(conn: &Connection) -> Result<Vec<String>, duckdb::Error> {
    let mut stmt = conn.prepare(
        "SELECT DISTINCT m.currency
         FROM mrr_log m
         LEFT JOIN exchange_rates er ON er.currency = m.currency
         WHERE er.currency IS NULL
         ORDER BY m.currency"
    )?;
    let mut rows = stmt.query([])?;
    let mut result = Vec::new();
    while let Some(row) = rows.next()? {
        let c: String = row.get(0)?;
        result.push(c);
    }
    Ok(result)
}

