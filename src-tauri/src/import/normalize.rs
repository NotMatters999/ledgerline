use chrono::NaiveDate;

#[derive(Debug, thiserror::Error, PartialEq, Clone)]
pub enum NormalizeError {
    #[error("Failed to parse date: {0}")]
    InvalidDate(String),
    #[error("Ambiguous date format (DD/MM vs MM/DD). Please specify.")]
    AmbiguousDateFormat,
    #[error("Failed to parse amount: {0}")]
    InvalidAmount(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum DateFormat {
    YyyyMmDd,      // YYYY-MM-DD
    DdMmYyyySlash, // DD/MM/YYYY
    MmDdYyyySlash, // MM/DD/YYYY
    YyyyMmDdSlash, // YYYY/MM/DD
    DdMmYyyyDash,  // DD-MM-YYYY
    MmmDdYyyy,     // MMM DD YYYY
}

impl DateFormat {
    pub fn parse(&self, s: &str) -> Option<NaiveDate> {
        match self {
            DateFormat::YyyyMmDd => NaiveDate::parse_from_str(s, "%Y-%m-%d").ok(),
            DateFormat::DdMmYyyySlash => NaiveDate::parse_from_str(s, "%d/%m/%Y").ok(),
            DateFormat::MmDdYyyySlash => NaiveDate::parse_from_str(s, "%m/%d/%Y").ok(),
            DateFormat::YyyyMmDdSlash => NaiveDate::parse_from_str(s, "%Y/%m/%d").ok(),
            DateFormat::DdMmYyyyDash => NaiveDate::parse_from_str(s, "%d-%m-%Y").ok(),
            DateFormat::MmmDdYyyy => NaiveDate::parse_from_str(s, "%b %d %Y").ok(),
        }
    }
}

pub fn detect_date_format(samples: &[String]) -> Result<DateFormat, NormalizeError> {
    let mut format_votes = std::collections::HashMap::new();
    
    let mut could_be_dd_mm = true;
    let mut could_be_mm_dd = true;
    let mut slash_count = 0;

    for s in samples {
        let s = s.trim();
        if s.is_empty() { continue; }
        
        if NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok() {
            *format_votes.entry(DateFormat::YyyyMmDd).or_insert(0) += 1;
            continue;
        }
        if NaiveDate::parse_from_str(s, "%Y/%m/%d").is_ok() {
            *format_votes.entry(DateFormat::YyyyMmDdSlash).or_insert(0) += 1;
            continue;
        }
        if NaiveDate::parse_from_str(s, "%d-%m-%Y").is_ok() {
            *format_votes.entry(DateFormat::DdMmYyyyDash).or_insert(0) += 1;
            continue;
        }
        if NaiveDate::parse_from_str(s, "%b %d %Y").is_ok() {
            *format_votes.entry(DateFormat::MmmDdYyyy).or_insert(0) += 1;
            continue;
        }
        
        let dd_ok = NaiveDate::parse_from_str(s, "%d/%m/%Y").is_ok();
        let mm_ok = NaiveDate::parse_from_str(s, "%m/%d/%Y").is_ok();
        
        if dd_ok || mm_ok {
            slash_count += 1;
            if !dd_ok { could_be_dd_mm = false; }
            if !mm_ok { could_be_mm_dd = false; }
        }
    }
    
    // Non-slash formats
    if let Some((&fmt, &count)) = format_votes.iter().max_by_key(|&(_, count)| count) {
        if count > slash_count {
            return Ok(fmt);
        }
    }
    
    if slash_count > 0 {
        if could_be_dd_mm && !could_be_mm_dd {
            return Ok(DateFormat::DdMmYyyySlash);
        }
        if !could_be_dd_mm && could_be_mm_dd {
            return Ok(DateFormat::MmDdYyyySlash);
        }
        if could_be_dd_mm && could_be_mm_dd {
            return Err(NormalizeError::AmbiguousDateFormat);
        }
    }

    Err(NormalizeError::InvalidDate("Could not detect any known format".into()))
}

pub fn clean_currency(s: &str) -> Result<f64, NormalizeError> {
    let s = s.trim();
    if s.is_empty() { return Ok(0.0); }
    
    // Determine sign: standard minus or accounting parentheses e.g. (1,234.56)
    let is_negative = s.contains('-') || (s.starts_with('(') && s.ends_with(')'));
    
    let has_comma = s.contains(',');
    let has_dot = s.contains('.');
    
    let is_european = if has_comma && has_dot {
        s.rfind(',') > s.rfind('.')
    } else if has_comma {
        let parts: Vec<&str> = s.split(',').collect();
        let last_digits: String = parts.last().unwrap().chars().filter(|c| c.is_ascii_digit()).collect();
        if last_digits.len() == 3 {
            return Err(NormalizeError::InvalidAmount(format!("Ambiguous format (thousands or decimal?): {}", s)));
        }
        true // Decimal comma
    } else if has_dot {
        let parts: Vec<&str> = s.split('.').collect();
        let last_digits: String = parts.last().unwrap().chars().filter(|c| c.is_ascii_digit()).collect();
        if last_digits.len() == 3 {
            return Err(NormalizeError::InvalidAmount(format!("Ambiguous format (thousands or decimal?): {}", s)));
        }
        false // Decimal dot
    } else {
        false
    };

    let cleaned: String = if is_european {
        s.chars()
            .filter(|&c| c.is_ascii_digit() || c == ',')
            .map(|c| if c == ',' { '.' } else { c })
            .collect()
    } else {
        s.chars()
            .filter(|&c| c.is_ascii_digit() || c == '.')
            .collect()
    };
    
    if cleaned.is_empty() { return Ok(0.0); }
    
    let mut val = cleaned.parse::<f64>().map_err(|_| NormalizeError::InvalidAmount(s.to_string()))?;
    if is_negative {
        val = -val;
    }
    Ok(val)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_currency() {
        assert_eq!(clean_currency("$1,234.56").unwrap(), 1234.56);
        assert_eq!(clean_currency("- 500").unwrap(), -500.0);
        assert_eq!(clean_currency("100.00 USD").unwrap(), 100.0);
        
        // European formats
        assert_eq!(clean_currency("1.234,56 €").unwrap(), 1234.56);
        assert_eq!(clean_currency("100,50").unwrap(), 100.5);
        assert_eq!(clean_currency("-1.000,00").unwrap(), -1000.0);
        
        // Accounting negative format
        assert_eq!(clean_currency("(1,234.56)").unwrap(), -1234.56);
        
        // Ambiguous formats (exactly 3 digits after only separator)
        assert!(matches!(clean_currency("1.234"), Err(NormalizeError::InvalidAmount(_))));
        assert!(matches!(clean_currency("1,234"), Err(NormalizeError::InvalidAmount(_))));
    }

    #[test]
    fn test_detect_date_format_unambiguous() {
        let samples = vec!["2024-01-15".to_string(), "2024-02-15".to_string()];
        assert_eq!(detect_date_format(&samples).unwrap(), DateFormat::YyyyMmDd);

        let samples = vec!["15/01/2024".to_string(), "10/01/2024".to_string()];
        assert_eq!(detect_date_format(&samples).unwrap(), DateFormat::DdMmYyyySlash);
        
        let samples = vec!["01/15/2024".to_string(), "01/10/2024".to_string()];
        assert_eq!(detect_date_format(&samples).unwrap(), DateFormat::MmDdYyyySlash);
    }

    #[test]
    fn test_detect_date_format_ambiguous() {
        let samples = vec!["05/03/2024".to_string(), "10/01/2024".to_string()];
        assert_eq!(detect_date_format(&samples), Err(NormalizeError::AmbiguousDateFormat));
    }
}
