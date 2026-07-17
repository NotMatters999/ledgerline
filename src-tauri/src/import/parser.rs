use std::path::Path;
use calamine::{Reader, open_workbook_auto, Data};
use csv::ReaderBuilder;

#[derive(Debug, thiserror::Error)]
pub enum ParserError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("CSV error: {0}")]
    Csv(#[from] csv::Error),
    #[error("Excel error: {0}")]
    Excel(String),
    #[error("Unsupported file extension")]
    UnsupportedExtension,
    #[error("Worksheet empty or not found")]
    EmptyWorksheet,
}

pub struct ParsedFile {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

pub fn parse_file(path: &Path) -> Result<ParsedFile, ParserError> {
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    match ext.as_str() {
        "csv" => parse_csv(path),
        "xlsx" | "xls" | "ods" => parse_excel(path),
        _ => Err(ParserError::UnsupportedExtension),
    }
}

fn parse_csv(path: &Path) -> Result<ParsedFile, ParserError> {
    let mut rdr = ReaderBuilder::new().from_path(path)?;
    let headers = rdr.headers()?.iter().map(|h| h.trim().to_string()).collect::<Vec<_>>();
    let mut rows = Vec::new();
    for result in rdr.records() {
        let record = result?;
        rows.push(record.iter().map(|f| f.trim().to_string()).collect());
    }
    Ok(ParsedFile { headers, rows })
}

fn parse_excel(path: &Path) -> Result<ParsedFile, ParserError> {
    let mut workbook = open_workbook_auto(path).map_err(|e| ParserError::Excel(e.to_string()))?;
    let sheet_names = workbook.sheet_names().to_vec();
    let first_sheet = sheet_names.first().ok_or(ParserError::EmptyWorksheet)?;
    
    let range = workbook.worksheet_range(first_sheet)
        .map_err(|e| ParserError::Excel(e.to_string()))?;

    let mut iter = range.rows();
    
    let headers = match iter.next() {
        Some(row) => row.iter().map(|cell| match cell {
            Data::Empty => String::new(),
            Data::String(s) => s.trim().to_string(),
            Data::Float(f) => f.to_string(),
            Data::Int(i) => i.to_string(),
            Data::Bool(b) => b.to_string(),
            Data::DateTime(d) => d.to_string(),
            Data::Error(e) => e.to_string(),
        }).collect::<Vec<_>>(),
        None => return Err(ParserError::EmptyWorksheet),
    };

    let mut rows = Vec::new();
    for row in iter {
        let row_vec = row.iter().map(|cell| match cell {
            Data::Empty => String::new(),
            Data::String(s) => s.trim().to_string(),
            Data::Float(f) => f.to_string(),
            Data::Int(i) => i.to_string(),
            Data::Bool(b) => b.to_string(),
            Data::DateTime(_) => {
                if let Some(s) = cell.as_datetime() {
                    s.to_string()
                } else if let Some(s) = cell.as_date() {
                    s.to_string()
                } else if let Some(s) = cell.as_time() {
                    s.to_string()
                } else {
                    cell.to_string()
                }
            },
            Data::Error(e) => e.to_string(),
        }).collect();
        rows.push(row_vec);
    }

    Ok(ParsedFile { headers, rows })
}
