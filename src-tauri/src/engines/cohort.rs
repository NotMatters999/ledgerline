use duckdb::Connection;
use serde::Serialize;
use std::collections::{HashMap, BTreeMap};
use chrono::NaiveDate;

#[derive(Debug, Serialize, Clone)]
pub struct CohortCell {
    pub month_index: usize,
    pub retained_customers: usize,
    pub retained_revenue: f64,
}

#[derive(Debug, Serialize, Clone)]
pub struct CohortRow {
    pub join_month: String,
    pub new_customers: usize,
    pub new_revenue: f64,
    pub data: Vec<CohortCell>,
}

#[derive(Debug, Serialize, Clone)]
pub struct CohortData {
    pub rows: Vec<CohortRow>,
}

pub fn calculate_cohorts(conn: &Connection) -> Result<CohortData, duckdb::Error> {
    let mut stmt = conn.prepare(
        "SELECT customer_id, 
                date_trunc('month', period)::DATE as month_start, 
                SUM(mrr_amount) as mrr 
         FROM mrr_log 
         GROUP BY customer_id, month_start 
         ORDER BY customer_id, month_start"
    )?;

    let mut rows = stmt.query([])?;
    
    // customer_id -> (join_month, Vec<(month, mrr)>)
    let mut customer_history: HashMap<String, (NaiveDate, Vec<(NaiveDate, f64)>)> = HashMap::new();

    while let Some(row) = rows.next()? {
        let cust: String = row.get(0)?;
        let month: NaiveDate = row.get(1)?;
        let mrr: f64 = row.get(2)?;
        
        if mrr <= 0.0 {
            continue;
        }

        let entry = customer_history.entry(cust.clone()).or_insert_with(|| (month, Vec::new()));
        
        // If this is earlier than current join_month, update join_month.
        // Since SQL is sorted by customer_id and month, the first >0 MRR row is the join_month.
        if month < entry.0 {
            entry.0 = month;
        }
        
        entry.1.push((month, mrr));
    }

    // Now aggregate into cohorts: join_month -> month_index -> { customers, revenue }
    let mut cohorts: BTreeMap<NaiveDate, BTreeMap<usize, (usize, f64)>> = BTreeMap::new();

    for (_cust, (join_month, history)) in customer_history {
        for (month, mrr) in history {
            // calculate month_index (months between join_month and month)
            let mut month_diff = (month.year() - join_month.year()) * 12;
            month_diff += month.month() as i32 - join_month.month() as i32;
            
            if month_diff < 0 {
                continue; // Should not happen given sorting, but safe fallback
            }
            
            let idx = month_diff as usize;
            
            let cohort_entry = cohorts.entry(join_month).or_default();
            let cell = cohort_entry.entry(idx).or_insert((0, 0.0));
            cell.0 += 1; // 1 customer
            cell.1 += mrr;
        }
    }

    let mut result_rows = Vec::new();
    for (join_month, cells) in cohorts {
        let (new_customers, new_revenue) = cells.get(&0).cloned().unwrap_or((0, 0.0));
        
        let mut data = Vec::new();
        // Determine the max month_index to ensure we fill missing cells with 0
        let max_idx = cells.keys().last().cloned().unwrap_or(0);
        
        for idx in 0..=max_idx {
            let (retained_customers, retained_revenue) = cells.get(&idx).cloned().unwrap_or((0, 0.0));
            data.push(CohortCell {
                month_index: idx,
                retained_customers,
                retained_revenue,
            });
        }
        
        result_rows.push(CohortRow {
            join_month: join_month.format("%Y-%m-%d").to_string(),
            new_customers,
            new_revenue,
            data,
        });
    }

    Ok(CohortData { rows: result_rows })
}
