use sha2::{Sha256, Digest};
use std::path::Path;
use std::fs;

pub fn file_hash(path: &Path) -> Result<String, std::io::Error> {
    let bytes = fs::read(path)?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let result = hasher.finalize();
    Ok(format!("{:x}", result))
}

pub fn dataset_fingerprint(normalized_rows: &[(String, String, f64)]) -> String {
    let mut hasher = Sha256::new();
    for row in normalized_rows {
        hasher.update(row.0.as_bytes());
        hasher.update(row.1.as_bytes());
        hasher.update(row.2.to_string().as_bytes());
    }
    let result = hasher.finalize();
    format!("{:x}", result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dataset_fingerprint_deterministic() {
        let rows = vec![
            ("cust_1".to_string(), "2024-01-01".to_string(), 100.0),
            ("cust_2".to_string(), "2024-01-01".to_string(), 200.0),
        ];
        
        let fp1 = dataset_fingerprint(&rows);
        let fp2 = dataset_fingerprint(&rows);
        assert_eq!(fp1, fp2);
        
        let rows_diff = vec![
            ("cust_1".to_string(), "2024-01-01".to_string(), 100.0),
            ("cust_2".to_string(), "2024-01-01".to_string(), 200.1),
        ];
        let fp3 = dataset_fingerprint(&rows_diff);
        assert_ne!(fp1, fp3);
    }
}
