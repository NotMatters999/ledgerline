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
    #[error("Likely duplicate dataset (same row count and total MRR as previous import).")]
    LikelyDuplicate,
    #[error("Validation failed for one or more rows.")]
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
}

pub fn preview(path: &Path) -> Result<PreviewResult, ImportError> {
    let parsed = parse_file(path)?;
    let mapped = detect_columns(&parsed.headers);

    if !mapped.is_complete() {
        return Err(ImportError::MissingColumns(mapped.clone()));
    }

    let customer_idx = mapped.customer_id_idx.unwrap();
    let date_idx = mapped.date_idx.unwrap();
    let amount_idx = mapped.revenue_idx.unwrap();

    let sample_rows: Vec<&Vec<String>> = parsed.rows.iter().take(50).collect();
    
    let date_samples: Vec<String> = sample_rows.iter().map(|r| r.get(date_idx).cloned().unwrap_or_default()).collect();
    let format = detect_date_format(&date_samples)?;

    let currency_idx = mapped.currency_idx;
    let category_idx = mapped.category_idx;

    let mut sample_normalized = Vec::new();
    for row in sample_rows.iter().take(5) { 
        let customer = row.get(customer_idx).cloned().unwrap_or_default().trim().to_string();
        let date_str = row.get(date_idx).cloned().unwrap_or_default();
        let amount_str = row.get(amount_idx).cloned().unwrap_or_default();
        let currency = currency_idx.and_then(|i| row.get(i)).cloned().unwrap_or_else(|| "USD".to_string()).trim().to_string();
        let category = category_idx.and_then(|i| row.get(i)).cloned().unwrap_or_else(|| "Standard".to_string()).trim().to_string();
        
        if customer.is_empty() && date_str.is_empty() && amount_str.is_empty() {
            continue; 
        }

        let date = format.parse(&date_str).ok_or_else(|| NormalizeError::InvalidDate(date_str.clone()))?;
        let amount = clean_currency(&amount_str)?;

        sample_normalized.push((customer, date.format("%Y-%m-%d").to_string(), amount, currency, category));
    }

    Ok(PreviewResult {
        mapped_columns: mapped,
        date_format: Some(format!("{:?}", format)),
        sample_normalized,
    })
}

pub fn commit(conn: &mut Connection, path: &Path) -> Result<(), ImportError> {
    let parsed = parse_file(path)?;
    let mapped = detect_columns(&parsed.headers);

    if !mapped.is_complete() {
        return Err(ImportError::MissingColumns(mapped.clone()));
    }

    let customer_idx = mapped.customer_id_idx.unwrap();
    let date_idx = mapped.date_idx.unwrap();
    let amount_idx = mapped.revenue_idx.unwrap();

    let date_samples: Vec<String> = parsed.rows.iter().take(50).map(|r| r.get(date_idx).cloned().unwrap_or_default()).collect();
    let format = detect_date_format(&date_samples)?;

    let currency_idx = mapped.currency_idx;
    let category_idx = mapped.category_idx;

    let mut normalized_rows = Vec::with_capacity(parsed.rows.len());
    let mut total_amount = 0.0;

    for row in &parsed.rows {
        let customer = row.get(customer_idx).cloned().unwrap_or_default().trim().to_string();
        let date_str = row.get(date_idx).cloned().unwrap_or_default();
        let amount_str = row.get(amount_idx).cloned().unwrap_or_default();
        let currency = currency_idx.and_then(|i| row.get(i)).cloned().unwrap_or_else(|| "USD".to_string()).trim().to_string();
        let category = category_idx.and_then(|i| row.get(i)).cloned().unwrap_or_else(|| "Standard".to_string()).trim().to_string();

        if customer.is_empty() && date_str.is_empty() && amount_str.is_empty() {
            continue; 
        }

        let date = format.parse(&date_str).ok_or_else(|| NormalizeError::InvalidDate(date_str.clone()))?;
        let amount = clean_currency(&amount_str)?;
        
        let date_iso = date.format("%Y-%m-%d").to_string();
        
        total_amount += amount;
        normalized_rows.push((customer, date_iso, amount, currency, category));
    }

    let mut validation_errors = Vec::new();
    for (i, row) in normalized_rows.iter().enumerate() {
        if let Err(e) = validate_row(i + 1, &row.0, &row.1, row.2, &row.3, &row.4) {
            validation_errors.push(e);
        }
    }

    if !validation_errors.is_empty() {
        return Err(ImportError::Validation(validation_errors));
    }

    let f_hash = file_hash(path).unwrap_or_default();
    let f_print = dataset_fingerprint(&normalized_rows);

    let tx = conn.transaction()?;

    let mut stmt = tx.prepare("SELECT file_hash, fingerprint, row_count, total_amount FROM import_history")?;
    let mut rows = stmt.query([])?;
    
    while let Some(row) = rows.next()? {
        let h: String = row.get(0)?;
        let fp: String = row.get(1)?;
        let rc: i64 = row.get(2)?;
        let ta: f64 = row.get(3)?;

        if h == f_hash && !f_hash.is_empty() {
            return Err(ImportError::DuplicateFileHash);
        }
        if fp == f_print {
            return Err(ImportError::DuplicateFingerprint);
        }
        if rc == normalized_rows.len() as i64 && (ta - total_amount).abs() < 0.01 {
            return Err(ImportError::LikelyDuplicate);
        }
    }
    
    drop(rows);
    drop(stmt);

    let import_id = Uuid::new_v4().to_string();

    {
        let mut app_stmt = tx.prepare("INSERT INTO import_history (id, file_hash, fingerprint, imported_at, row_count, status, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?)")?;
        app_stmt.execute(duckdb::params![import_id, f_hash, f_print, Utc::now().to_rfc3339(), normalized_rows.len() as i64, "SUCCESS", total_amount])?;
    }

    {
        let mut insert_stmt = tx.prepare("INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES (?, ?, ?, ?)")?;
        for row in &normalized_rows {
            // Note: Schema currently does not have a category column in mrr_log, so we just drop it or store in metadata later
            insert_stmt.execute(duckdb::params![row.0, row.1, row.2, row.3])?;
        }
    }

    tx.commit()?;
    Ok(())
}
