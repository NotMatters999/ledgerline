use std::path::Path;
use serde::Serialize;
use duckdb::Connection;
use chrono::Utc;
use uuid::Uuid;

use crate::import::parser::{parse_file, ParserError};
use crate::import::alias_map::{detect_columns, MappedColumns};
use crate::import::normalize::{detect_date_format, clean_currency, NormalizeError};
use crate::import::fingerprint::{file_hash, dataset_fingerprint};
use crate::validation::{validate_row, ValidationError};

#[derive(Debug, thiserror::Error)]
pub enum ImportError {
    #[error("Parser error: {0}")]
    Parser(#[from] ParserError),
    #[error("Missing required columns. Found: {0:?}")]
    MissingColumns(MappedColumns),
    #[error("Normalize error: {0}")]
    Normalize(#[from] NormalizeError),
    #[error("Database error: {0}")]
    Database(#[from] duckdb::Error),
    #[error("Duplicate file hash detected. File already imported.")]
    DuplicateFileHash,
    #[error("Duplicate dataset fingerprint detected. Data already imported.")]
    DuplicateFingerprint,
    #[error("Validation failed for one or more rows: {0:?}")]
    Validation(Vec<ValidationError>),
}

impl serde::Serialize for ImportError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[derive(Serialize)]
pub struct PreviewResult {
    pub mapped_columns: MappedColumns,
    pub date_format: Option<String>,
    pub sample_normalized: Vec<(String, String, f64, String, String)>, // (customer_id, date, amount, currency, category)
    pub total_rows: usize, // total parseable rows in the file (not capped to preview sample)
}

/// Returned by `commit()` — tells the caller how many rows were freshly
/// inserted versus how many already existed and were overwritten (upserted).
#[derive(Serialize, Clone, Debug)]
pub struct ImportResult {
    pub inserted: usize,
    pub updated: usize,
}

pub fn preview(path: &Path) -> Result<PreviewResult, ImportError> {
    let parsed = parse_file(path)?;
    let mapped = detect_columns(&parsed.headers);

    let (customer_idx, date_idx, amount_idx) = match (mapped.customer_id_idx, mapped.date_idx, mapped.revenue_idx) {
        (Some(c), Some(d), Some(a)) => (c, d, a),
        _ => return Err(ImportError::MissingColumns(mapped.clone())),
    };

    let sample_rows: Vec<&Vec<String>> = parsed.rows.iter().take(50).collect();

    // Collect up to 50 non-blank date values from the entire file so that
    // sparse or late-starting files still yield enough samples for detection.
    let date_samples: Vec<String> = parsed.rows.iter()
        .filter_map(|r| r.get(date_idx))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .take(50)
        .collect();
    let format = detect_date_format(&date_samples)?;

    let currency_idx = mapped.currency_idx;
    let category_idx = mapped.category_idx;

    let mut sample_normalized = Vec::new();
    for row in sample_rows.iter().take(5) { 
        let customer = row.get(customer_idx).cloned().unwrap_or_default().trim().to_string();
        let date_str = row.get(date_idx).cloned().unwrap_or_default();
        let amount_str = row.get(amount_idx).cloned().unwrap_or_default();
        let currency = currency_idx.and_then(|i| row.get(i)).map(|s| s.trim()).filter(|s| !s.is_empty()).unwrap_or("USD").to_string();
        let category = category_idx.and_then(|i| row.get(i)).map(|s| s.trim()).filter(|s| !s.is_empty()).unwrap_or("Standard").to_string();
        
        if customer.is_empty() && date_str.is_empty() && amount_str.is_empty() {
            continue; 
        }

        let date = match format.parse(&date_str) {
            Some(d) => d,
            None => continue,
        };
        let amount = match clean_currency(&amount_str) {
            Ok(a) => a,
            Err(_) => continue,
        };

        sample_normalized.push((customer, date.format("%Y-%m-%d").to_string(), amount, currency, category));
    }

    Ok(PreviewResult {
        mapped_columns: mapped,
        date_format: Some(format!("{:?}", format)),
        sample_normalized,
        total_rows: parsed.rows.iter().filter(|r| {
            // count non-blank rows only, consistent with how commit() counts them
            let c = r.get(customer_idx).map(|s| s.trim()).unwrap_or("");
            let d = r.get(date_idx).map(|s| s.trim()).unwrap_or("");
            let a = r.get(amount_idx).map(|s| s.trim()).unwrap_or("");
            !(c.is_empty() && d.is_empty() && a.is_empty())
        }).count(),
    })
}

pub fn commit(conn: &mut Connection, path: &Path) -> Result<ImportResult, ImportError> {
    let parsed = parse_file(path)?;
    let mapped = detect_columns(&parsed.headers);

    let (customer_idx, date_idx, amount_idx) = match (mapped.customer_id_idx, mapped.date_idx, mapped.revenue_idx) {
        (Some(c), Some(d), Some(a)) => (c, d, a),
        _ => return Err(ImportError::MissingColumns(mapped.clone())),
    };

    // Skip blank cells; scan the whole file so sparse headers don't mislead detection.
    let date_samples: Vec<String> = parsed.rows.iter()
        .filter_map(|r| r.get(date_idx))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .take(50)
        .collect();
    let format = detect_date_format(&date_samples)?;

    let currency_idx = mapped.currency_idx;
    let category_idx = mapped.category_idx;

    let mut normalized_rows = Vec::with_capacity(parsed.rows.len());
    let mut total_amount = 0.0;
    let mut validation_errors = Vec::new();

    for (i, row) in parsed.rows.iter().enumerate() {
        let customer = row.get(customer_idx).cloned().unwrap_or_default().trim().to_string();
        let date_str = row.get(date_idx).cloned().unwrap_or_default();
        let amount_str = row.get(amount_idx).cloned().unwrap_or_default();
        let currency = currency_idx.and_then(|idx| row.get(idx)).map(|s| s.trim()).filter(|s| !s.is_empty()).unwrap_or("USD").to_string();
        let category = category_idx.and_then(|idx| row.get(idx)).map(|s| s.trim()).filter(|s| !s.is_empty()).unwrap_or("Standard").to_string();

        if customer.is_empty() && date_str.is_empty() && amount_str.is_empty() {
            continue; 
        }

        let date = match format.parse(&date_str) {
            Some(d) => d,
            None => {
                validation_errors.push(ValidationError {
                    row_number: i + 2,
                    reason: format!("Invalid date format: {}", date_str),
                });
                continue;
            }
        };

        let amount = match clean_currency(&amount_str) {
            Ok(a) => a,
            Err(e) => {
                validation_errors.push(ValidationError {
                    row_number: i + 2,
                    reason: format!("Invalid amount: {}", e),
                });
                continue;
            }
        };
        
        let date_iso = date.format("%Y-%m-%d").to_string();
        
        total_amount += amount;
        normalized_rows.push((i + 2, (customer, date_iso, amount, currency, category)));
    }

    let mut final_rows = Vec::with_capacity(normalized_rows.len());
    for (row_idx, row) in normalized_rows.into_iter() {
        if let Err(e) = validate_row(row_idx, &row.0, &row.1, row.2, &row.3, &row.4) {
            validation_errors.push(e);
        } else {
            final_rows.push(row);
        }
    }

    if !validation_errors.is_empty() {
        return Err(ImportError::Validation(validation_errors));
    }

    let f_hash = file_hash(path).unwrap_or_default();
    let f_print = dataset_fingerprint(&final_rows);

    let tx = conn.transaction()?;

    let mut stmt = tx.prepare("SELECT file_hash, fingerprint FROM import_history")?;
    let mut rows = stmt.query([])?;
    
    while let Some(row) = rows.next()? {
        let h: String = row.get(0)?;
        let fp: String = row.get(1)?;

        if h == f_hash && !f_hash.is_empty() {
            return Err(ImportError::DuplicateFileHash);
        }
        if fp == f_print {
            return Err(ImportError::DuplicateFingerprint);
        }
    }
    
    drop(rows);
    drop(stmt);

    // ── Count how many incoming (customer_id, period) pairs already exist ──
    // We do this inside the transaction so the read is consistent.
    // Build the list of (customer_id, period) tuples as a VALUES clause.
    let updated_count: usize = if final_rows.is_empty() {
        0
    } else {
        // Use a temporary table approach for correctness with large datasets.
        tx.execute_batch("CREATE TEMPORARY TABLE IF NOT EXISTS _import_staging (customer_id VARCHAR, period VARCHAR)")?;
        tx.execute_batch("DELETE FROM _import_staging")?;
        {
            let mut ins = tx.prepare("INSERT INTO _import_staging VALUES (?, ?)")?;
            for row in &final_rows {
                ins.execute(duckdb::params![row.0, row.1])?;
            }
        }
        let count: i64 = tx.query_row(
            "SELECT COUNT(*) FROM mrr_log m
             INNER JOIN _import_staging s ON s.customer_id = m.customer_id AND m.period::VARCHAR = s.period",
            [],
            |r| r.get(0),
        )?;
        tx.execute_batch("DROP TABLE IF EXISTS _import_staging")?;
        count as usize
    };

    let import_id = Uuid::new_v4().to_string();

    {
        let mut app_stmt = tx.prepare("INSERT INTO import_history (id, file_hash, fingerprint, imported_at, row_count, status, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?)")?;
        app_stmt.execute(duckdb::params![import_id, f_hash, f_print, Utc::now().to_rfc3339(), final_rows.len() as i64, "SUCCESS", total_amount])?;
    }

    {
        let mut insert_stmt = tx.prepare("INSERT INTO mrr_log (customer_id, period, mrr_amount, currency, category) VALUES (?, ?, ?, ?, ?) ON CONFLICT (customer_id, period) DO UPDATE SET mrr_amount = excluded.mrr_amount, currency = excluded.currency, category = excluded.category")?;
        for row in &final_rows {
            insert_stmt.execute(duckdb::params![row.0, row.1, row.2, row.3, row.4])?;
        }
    }

    tx.commit()?;

    let total = final_rows.len();
    let updated = updated_count.min(total);
    let inserted = total - updated;

    Ok(ImportResult { inserted, updated })
}
