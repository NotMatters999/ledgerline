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

fn update_prefixed(hasher: &mut Sha256, val: &str) {
    let bytes = val.as_bytes();
    hasher.update(&(bytes.len() as u64).to_be_bytes());
    hasher.update(bytes);
}

pub fn dataset_fingerprint(normalized_rows: &[(String, String, f64, String, String)]) -> String {
    // Note: The hashing algorithm was updated to use length-prefixed encoding 
    // to prevent delimiter collision attacks. Fingerprints computed under the 
    // old delimiter-based scheme are not comparable to new ones.
    let mut hasher = Sha256::new();
    for row in normalized_rows {
        update_prefixed(&mut hasher, &row.0);
        update_prefixed(&mut hasher, &row.1);
        update_prefixed(&mut hasher, &row.2.to_string());
        update_prefixed(&mut hasher, &row.3);
        update_prefixed(&mut hasher, &row.4);
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
            ("cust_1".to_string(), "2024-01-01".to_string(), 100.0, "USD".to_string(), "SaaS".to_string()),
            ("cust_2".to_string(), "2024-01-01".to_string(), 200.0, "USD".to_string(), "SaaS".to_string()),
        ];
        
        let fp1 = dataset_fingerprint(&rows);
        let fp2 = dataset_fingerprint(&rows);
        assert_eq!(fp1, fp2);
        
        let rows_diff = vec![
            ("cust_1".to_string(), "2024-01-01".to_string(), 100.0, "USD".to_string(), "SaaS".to_string()),
            ("cust_2".to_string(), "2024-01-01".to_string(), 200.1, "USD".to_string(), "SaaS".to_string()),
        ];
        let fp3 = dataset_fingerprint(&rows_diff);
        assert_ne!(fp1, fp3);
    }

    #[test]
    fn test_collision_prevention() {
        // Old logic using `|` would hash these two identically
        let rows1 = vec![
            ("A|B".to_string(), "C".to_string(), 100.0, "USD".to_string(), "SaaS".to_string()),
        ];
        let rows2 = vec![
            ("A".to_string(), "B|C".to_string(), 100.0, "USD".to_string(), "SaaS".to_string()),
        ];
        
        let fp1 = dataset_fingerprint(&rows1);
        let fp2 = dataset_fingerprint(&rows2);
        assert_ne!(fp1, fp2, "Fingerprints should not collide when fields contain delimiters");
    }
}
