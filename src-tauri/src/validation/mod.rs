use chrono::NaiveDate;
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct ValidationError {
    pub row_number: usize,
    pub reason: String,
}

pub fn validate_row(
    row_number: usize,
    customer_id: &str,
    date_str: &str,
    amount: f64,
    currency: &str,
    _category: &str,
) -> Result<(), ValidationError> {
    if customer_id.trim().is_empty() {
        return Err(ValidationError {
            row_number,
            reason: "Missing customer_id".to_string(),
        });
    }

    if currency.trim().is_empty() {
        return Err(ValidationError {
            row_number,
            reason: "Empty currency".to_string(),
        });
    }

    // Category validation removed to allow empty categories or rows without category.

    if amount.is_nan() || amount.is_infinite() {
        return Err(ValidationError {
            row_number,
            reason: "Amount is NaN or Infinity".to_string(),
        });
    }

    if amount < 0.0 {
        return Err(ValidationError {
            row_number,
            reason: "Negative MRR amounts are not allowed (unconditionally rejected)".to_string(),
        });
    }

    let _parsed_date = NaiveDate::parse_from_str(date_str, "%Y-%m-%d").map_err(|_| {
        ValidationError {
            row_number,
            reason: format!("Invalid date format (expected YYYY-MM-DD): {}", date_str),
        }
    })?;

    // Future date validation removed to allow forecasting/contracted MRR.


    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn test_valid_row() {
        let today_str = Utc::now().date_naive().format("%Y-%m-%d").to_string();
        assert!(validate_row(1, "cust_1", &today_str, 100.0, "USD", "Standard").is_ok());
    }

    #[test]
    fn test_invalid_negative_amount() {
        let err = validate_row(1, "cust_1", "2024-01-01", -10.0, "USD", "Standard").unwrap_err();
        assert_eq!(err.reason, "Negative MRR amounts are not allowed (unconditionally rejected)");
    }

    #[test]
    fn test_valid_future_date() {
        assert!(validate_row(1, "cust_1", "2050-01-01", 100.0, "USD", "Standard").is_ok());
    }

    #[test]
    fn test_missing_customer() {
        let err = validate_row(1, "   ", "2024-01-01", 100.0, "USD", "Standard").unwrap_err();
        assert_eq!(err.reason, "Missing customer_id");
    }

    #[test]
    fn test_nan_amount() {
        let err = validate_row(1, "cust_1", "2024-01-01", f64::NAN, "USD", "Standard").unwrap_err();
        assert_eq!(err.reason, "Amount is NaN or Infinity");
    }
}
