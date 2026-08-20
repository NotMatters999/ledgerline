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

/// All date formats the importer recognises.
///
/// Year-month-only variants (no day component) are normalised to the
/// **1st of that month** when parsed.  The stored `NaiveDate` is always
/// `YYYY-MM-01` for those rows.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum DateFormat {
    // ── Full date formats (year + month + day) ────────────────────────────
    YyyyMmDd,          // YYYY-MM-DD        e.g. 2024-01-15
    YyyyMmDdSlash,     // YYYY/MM/DD        e.g. 2024/01/15
    DdMmYyyySlash,     // DD/MM/YYYY        e.g. 15/01/2024
    MmDdYyyySlash,     // MM/DD/YYYY        e.g. 01/15/2024
    DdMmYyyyDash,      // DD-MM-YYYY        e.g. 15-01-2024
    MmDdYyyyDash,      // MM-DD-YYYY        e.g. 01-15-2024  (US with dashes)
    MmmDdYyyy,         // MMM DD YYYY       e.g. Jan 15 2024
    DdMmmYyyyDash,     // DD-MMM-YYYY       e.g. 01-Jan-2025
    DdMmmYyyySpace,    // DD MMM YYYY       e.g. 01 Jan 2025
    // ── Year-month-only formats → normalised to the 1st of the month ──────
    YyyyMm,            // YYYY-MM           e.g. 2025-01      ← root-cause format
    MmYyyySlash,       // MM/YYYY           e.g. 01/2025
    YyyyMmSlash,       // YYYY/MM           e.g. 2025/01
    MmmYyyy,           // MMM YYYY          e.g. Jan 2025
    MmmDashYyyy,       // MMM-YYYY          e.g. Jan-2025
    MmmmYyyy,          // MMMM YYYY         e.g. January 2025
}

// ── Internal helpers ──────────────────────────────────────────────────────

/// Parse a bare year + month pair into the 1st of that month.
fn parse_year_month(year_str: &str, month_str: &str) -> Option<NaiveDate> {
    let year  = year_str.trim().parse::<i32>().ok()?;
    let month = month_str.trim().parse::<u32>().ok()?;
    NaiveDate::from_ymd_opt(year, month, 1)
}

/// Try to identify the `DateFormat` for a single trimmed, non-empty string.
///
/// Returns `None` for the ambiguous `DD/MM/YYYY` vs `MM/DD/YYYY` slash pair
/// so `detect_date_format` can handle those with accumulation logic.
fn detect_single_format(s: &str) -> Option<DateFormat> {
    // ── Full-date formats — most specific first to avoid prefix clashes ──

    if NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok() {
        return Some(DateFormat::YyyyMmDd);
    }
    if NaiveDate::parse_from_str(s, "%Y/%m/%d").is_ok() {
        return Some(DateFormat::YyyyMmDdSlash);
    }
    if NaiveDate::parse_from_str(s, "%d-%b-%Y").is_ok() {
        return Some(DateFormat::DdMmmYyyyDash);
    }
    if NaiveDate::parse_from_str(s, "%d %b %Y").is_ok() {
        return Some(DateFormat::DdMmmYyyySpace);
    }
    if NaiveDate::parse_from_str(s, "%b %d %Y").is_ok() {
        return Some(DateFormat::MmmDdYyyy);
    }
    // Dash full-date (DD-MM-YYYY before MM-DD-YYYY; chrono validation
    // naturally disambiguates when one part exceeds 12).
    if NaiveDate::parse_from_str(s, "%d-%m-%Y").is_ok() {
        return Some(DateFormat::DdMmYyyyDash);
    }
    if NaiveDate::parse_from_str(s, "%m-%d-%Y").is_ok() {
        return Some(DateFormat::MmDdYyyyDash);
    }

    // ── Year-month-only formats (no day) — normalised to day 1 ───────────

    // YYYY-MM: 4-digit year, dash, 1-2 digit month, nothing after
    {
        let parts: Vec<&str> = s.splitn(2, '-').collect();
        if parts.len() == 2 && parts[0].len() == 4 && !parts[1].contains('-')
            && parse_year_month(parts[0], parts[1]).is_some()
        {
            return Some(DateFormat::YyyyMm);
        }
    }

    // MMM-YYYY: 3-char month abbreviation, dash, 4-digit year
    {
        let parts: Vec<&str> = s.splitn(2, '-').collect();
        if parts.len() == 2 && parts[0].len() == 3 && parts[1].len() == 4
            && NaiveDate::parse_from_str(
                &format!("{} 01 {}", parts[0], parts[1]),
                "%b %d %Y",
            ).is_ok()
        {
            return Some(DateFormat::MmmDashYyyy);
        }
    }

    // Slash-based year-month (both checked *before* the ambiguous DD/MM vs MM/DD pairs)
    {
        let parts: Vec<&str> = s.split('/').collect();
        if parts.len() == 2 {
            // MM/YYYY — second part is exactly 4 digits
            if parts[1].len() == 4 && parse_year_month(parts[1], parts[0]).is_some() {
                return Some(DateFormat::MmYyyySlash);
            }
            // YYYY/MM — first part is exactly 4 digits
            if parts[0].len() == 4 && parse_year_month(parts[0], parts[1]).is_some() {
                return Some(DateFormat::YyyyMmSlash);
            }
        }
    }

    // Space-separated named-month + year
    {
        let parts: Vec<&str> = s.splitn(2, ' ').collect();
        if parts.len() == 2 {
            let (mon, yr) = (parts[0], parts[1].trim());
            if mon.len() == 3 {
                // MMM YYYY — 3-char abbreviation
                if NaiveDate::parse_from_str(&format!("{} 01 {}", mon, yr), "%b %d %Y").is_ok() {
                    return Some(DateFormat::MmmYyyy);
                }
            } else if mon.len() > 3 {
                // MMMM YYYY — full month name
                if NaiveDate::parse_from_str(&format!("{} 01 {}", mon, yr), "%B %d %Y").is_ok() {
                    return Some(DateFormat::MmmmYyyy);
                }
            }
        }
    }

    None
}

// ── Public API ────────────────────────────────────────────────────────────

impl DateFormat {
    /// Parse `s` according to this format, returning a `NaiveDate`.
    ///
    /// Year-month-only formats return the **1st of the month** (e.g.
    /// `"2025-01"` → `NaiveDate(2025-01-01)`).  Returns `None` for values
    /// that don't conform to the format — callers should convert this to a
    /// per-row validation error.
    pub fn parse(&self, s: &str) -> Option<NaiveDate> {
        let s = s.trim();
        match self {
            // Full-date formats — delegate to chrono directly
            DateFormat::YyyyMmDd       => NaiveDate::parse_from_str(s, "%Y-%m-%d").ok(),
            DateFormat::YyyyMmDdSlash  => NaiveDate::parse_from_str(s, "%Y/%m/%d").ok(),
            DateFormat::DdMmYyyySlash  => NaiveDate::parse_from_str(s, "%d/%m/%Y").ok(),
            DateFormat::MmDdYyyySlash  => NaiveDate::parse_from_str(s, "%m/%d/%Y").ok(),
            DateFormat::DdMmYyyyDash   => NaiveDate::parse_from_str(s, "%d-%m-%Y").ok(),
            DateFormat::MmDdYyyyDash   => NaiveDate::parse_from_str(s, "%m-%d-%Y").ok(),
            DateFormat::MmmDdYyyy      => NaiveDate::parse_from_str(s, "%b %d %Y").ok(),
            DateFormat::DdMmmYyyyDash  => NaiveDate::parse_from_str(s, "%d-%b-%Y").ok(),
            DateFormat::DdMmmYyyySpace => NaiveDate::parse_from_str(s, "%d %b %Y").ok(),

            // Year-month formats — custom parsing, day always = 1
            DateFormat::YyyyMm => {
                let parts: Vec<&str> = s.splitn(2, '-').collect();
                if parts.len() == 2 && parts[0].len() == 4 {
                    parse_year_month(parts[0], parts[1])
                } else {
                    None
                }
            },
            DateFormat::MmYyyySlash => {
                let parts: Vec<&str> = s.split('/').collect();
                if parts.len() == 2 && parts[1].trim().len() == 4 {
                    parse_year_month(parts[1], parts[0])
                } else {
                    None
                }
            },
            DateFormat::YyyyMmSlash => {
                let parts: Vec<&str> = s.split('/').collect();
                if parts.len() == 2 && parts[0].len() == 4 {
                    parse_year_month(parts[0], parts[1])
                } else {
                    None
                }
            },
            DateFormat::MmmYyyy => {
                let parts: Vec<&str> = s.splitn(2, ' ').collect();
                if parts.len() == 2 {
                    NaiveDate::parse_from_str(
                        &format!("{} 01 {}", parts[0], parts[1].trim()),
                        "%b %d %Y",
                    ).ok()
                } else {
                    None
                }
            },
            DateFormat::MmmDashYyyy => {
                let parts: Vec<&str> = s.splitn(2, '-').collect();
                if parts.len() == 2 && parts[0].len() == 3 {
                    NaiveDate::parse_from_str(
                        &format!("{} 01 {}", parts[0], parts[1].trim()),
                        "%b %d %Y",
                    ).ok()
                } else {
                    None
                }
            },
            DateFormat::MmmmYyyy => {
                let parts: Vec<&str> = s.splitn(2, ' ').collect();
                if parts.len() == 2 {
                    NaiveDate::parse_from_str(
                        &format!("{} 01 {}", parts[0], parts[1].trim()),
                        "%B %d %Y",
                    ).ok()
                } else {
                    None
                }
            },
        }
    }
}

/// Detect the date format used across a set of sample strings.
///
/// Samples that are empty or whitespace-only are ignored — the caller should
/// already filter them, but this function is defensive about it.
///
/// Returns `Err(AmbiguousDateFormat)` if the slash-separated samples are
/// consistent with both `DD/MM/YYYY` and `MM/DD/YYYY`.
/// Returns `Err(InvalidDate("Could not detect any known format"))` if no
/// sample matches any recognised pattern.
pub fn detect_date_format(samples: &[String]) -> Result<DateFormat, NormalizeError> {
    let mut format_votes: std::collections::HashMap<DateFormat, usize> =
        std::collections::HashMap::new();
    let mut could_be_dd_mm = true;
    let mut could_be_mm_dd = true;
    let mut slash_full_count: usize = 0;

    for s in samples {
        let s = s.trim();
        if s.is_empty() {
            continue;
        }

        // Try every unambiguous format first
        if let Some(fmt) = detect_single_format(s) {
            *format_votes.entry(fmt).or_insert(0) += 1;
            continue;
        }

        // The one remaining ambiguity: DD/MM/YYYY vs MM/DD/YYYY
        let dd_ok = NaiveDate::parse_from_str(s, "%d/%m/%Y").is_ok();
        let mm_ok = NaiveDate::parse_from_str(s, "%m/%d/%Y").is_ok();
        if dd_ok || mm_ok {
            slash_full_count += 1;
            if !dd_ok { could_be_dd_mm = false; }
            if !mm_ok { could_be_mm_dd = false; }
        }
        // If neither matched, the sample is unrecognised — just skip it in voting.
    }

    // An unambiguous format with strictly more votes than all slash-ambiguous rows wins.
    if let Some((&fmt, &count)) = format_votes.iter().max_by_key(|(_, &c)| c) {
        if count > slash_full_count {
            return Ok(fmt);
        }
    }

    // Resolve the slash ambiguity
    if slash_full_count > 0 {
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

    Err(NormalizeError::InvalidDate(
        "Could not detect any known format".into(),
    ))
}

/// Parse a currency/amount string into a plain `f64`.
///
/// Handles:
/// - Leading/trailing currency symbols and ISO codes (`$`, `€`, `USD`, …)
/// - Standard negative (`-1234.56`) and accounting negative (`(1234.56)`)
/// - US format with thousands commas: `1,234.56` → `1234.56`
/// - European format with dot thousands and comma decimal: `1.234,56` → `1234.56`
/// - Bare integer or float with no separators: `1234`, `1234.5`
///
/// **Ambiguous cases kept as per-row errors (not silently resolved):**
/// `1,234` (lone comma, exactly 3 trailing digits) and `1.234` (lone dot,
/// exactly 3 trailing digits) are genuinely ambiguous between thousands and
/// decimal interpretations.  Silently picking one risks producing a wrong
/// revenue number, which is worse than a rejected row.  The error message
/// tells the user exactly how to fix their source file.
pub fn clean_currency(s: &str) -> Result<f64, NormalizeError> {
    let s = s.trim();
    if s.is_empty() {
        return Ok(0.0);
    }

    // Determine sign from leading minus or accounting parentheses
    let is_negative = s.contains('-') || (s.starts_with('(') && s.ends_with(')'));

    let has_comma = s.contains(',');
    let has_dot   = s.contains('.');

    let is_european = if has_comma && has_dot {
        // Both separators present: whichever comes last is the decimal separator
        s.rfind(',') > s.rfind('.')
    } else if has_comma {
        // Only comma: ambiguous if exactly 3 digits follow it
        let parts: Vec<&str> = s.split(',').collect();
        let last_digits: String = parts
            .last()
            .unwrap()
            .chars()
            .filter(|c| c.is_ascii_digit())
            .collect();
        if last_digits.len() == 3 {
            return Err(NormalizeError::InvalidAmount(format!(
                "Ambiguous value '{}': ',' followed by exactly 3 digits could be a \
                 thousands separator (value = {}) or a decimal comma (value = 0.{} in EU format). \
                 Remove thousands separators or reformat to an unambiguous decimal \
                 (e.g. {} or {}.00) in the source file before importing.",
                s,
                s.chars().filter(|c| c.is_ascii_digit()).collect::<String>(),
                last_digits,
                s.chars().filter(|c| c.is_ascii_digit()).collect::<String>(),
                s.chars().filter(|c| c.is_ascii_digit()).collect::<String>(),
            )));
        }
        true // Decimal comma
    } else if has_dot {
        // Only dot: ambiguous if exactly 3 digits follow it
        let parts: Vec<&str> = s.split('.').collect();
        let last_digits: String = parts
            .last()
            .unwrap()
            .chars()
            .filter(|c| c.is_ascii_digit())
            .collect();
        if last_digits.len() == 3 {
            return Err(NormalizeError::InvalidAmount(format!(
                "Ambiguous value '{}': '.' followed by exactly 3 digits could be a \
                 thousands separator (value = {}) or a decimal point (value = {}). \
                 Remove thousands separators or reformat to an unambiguous decimal \
                 (e.g. {} or {}.00) in the source file before importing.",
                s,
                s.chars().filter(|c| c.is_ascii_digit()).collect::<String>(),
                s.chars()
                    .filter(|c| c.is_ascii_digit() || *c == '.')
                    .collect::<String>(),
                s.chars().filter(|c| c.is_ascii_digit()).collect::<String>(),
                s.chars().filter(|c| c.is_ascii_digit()).collect::<String>(),
            )));
        }
        false // Decimal dot
    } else {
        false
    };

    // Strip everything except digits and the relevant decimal separator
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

    if cleaned.is_empty() {
        return Ok(0.0);
    }

    let mut val = cleaned
        .parse::<f64>()
        .map_err(|_| NormalizeError::InvalidAmount(s.to_string()))?;

    if is_negative {
        val = -val;
    }

    Ok(val)
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── clean_currency ───────────────────────────────────────────────────

    #[test]
    fn test_clean_currency_us_formats() {
        assert_eq!(clean_currency("$1,234.56").unwrap(), 1234.56);
        assert_eq!(clean_currency("100.00 USD").unwrap(), 100.0);
        assert_eq!(clean_currency("- 500").unwrap(), -500.0);
        assert_eq!(clean_currency("(1,234.56)").unwrap(), -1234.56);
        assert_eq!(clean_currency("1234").unwrap(), 1234.0);
        assert_eq!(clean_currency("0").unwrap(), 0.0);
        assert_eq!(clean_currency("").unwrap(), 0.0);
    }

    #[test]
    fn test_clean_currency_european_formats() {
        assert_eq!(clean_currency("1.234,56 €").unwrap(), 1234.56);
        assert_eq!(clean_currency("100,50").unwrap(), 100.5);
        assert_eq!(clean_currency("-1.000,00").unwrap(), -1000.0);
    }

    #[test]
    fn test_clean_currency_ambiguous_comma_is_error() {
        let err = clean_currency("1,234").unwrap_err();
        // Must still be an InvalidAmount — not a panic or crash
        assert!(matches!(err, NormalizeError::InvalidAmount(_)));
    }

    #[test]
    fn test_clean_currency_ambiguous_dot_is_error() {
        let err = clean_currency("1.234").unwrap_err();
        assert!(matches!(err, NormalizeError::InvalidAmount(_)));
    }

    #[test]
    fn test_clean_currency_ambiguous_message_is_actionable() {
        // The error message must tell the user how to fix it,
        // not just echo back the raw parse failure.
        let msg = clean_currency("1,234").unwrap_err().to_string();
        assert!(
            msg.contains("thousands separator"),
            "message should mention 'thousands separator'; got: {}",
            msg
        );
        assert!(
            msg.contains("source file"),
            "message should reference 'source file'; got: {}",
            msg
        );
    }

    // ── detect_date_format: original formats still work ──────────────────

    #[test]
    fn test_detect_yyyy_mm_dd() {
        let s = vec!["2024-01-15".to_string(), "2024-02-15".to_string()];
        assert_eq!(detect_date_format(&s).unwrap(), DateFormat::YyyyMmDd);
    }

    #[test]
    fn test_detect_dd_mm_yyyy_slash() {
        let s = vec!["15/01/2024".to_string(), "10/01/2024".to_string()];
        assert_eq!(detect_date_format(&s).unwrap(), DateFormat::DdMmYyyySlash);
    }

    #[test]
    fn test_detect_mm_dd_yyyy_slash() {
        let s = vec!["01/15/2024".to_string(), "01/10/2024".to_string()];
        assert_eq!(detect_date_format(&s).unwrap(), DateFormat::MmDdYyyySlash);
    }

    #[test]
    fn test_detect_ambiguous_slash() {
        let s = vec!["05/03/2024".to_string(), "10/01/2024".to_string()];
        assert_eq!(
            detect_date_format(&s),
            Err(NormalizeError::AmbiguousDateFormat)
        );
    }

    // ── detect_date_format: all 9 new formats ────────────────────────────

    #[test]
    fn test_detect_yyyy_mm() {
        let s = vec!["2025-01".to_string(), "2025-06".to_string(), "2024-12".to_string()];
        assert_eq!(detect_date_format(&s).unwrap(), DateFormat::YyyyMm);
    }

    #[test]
    fn test_detect_mm_yyyy_slash() {
        let s = vec!["01/2025".to_string(), "06/2025".to_string()];
        assert_eq!(detect_date_format(&s).unwrap(), DateFormat::MmYyyySlash);
    }

    #[test]
    fn test_detect_yyyy_mm_slash() {
        let s = vec!["2025/01".to_string(), "2025/06".to_string()];
        assert_eq!(detect_date_format(&s).unwrap(), DateFormat::YyyyMmSlash);
    }

    #[test]
    fn test_detect_mmm_yyyy() {
        let s = vec!["Jan 2025".to_string(), "Feb 2025".to_string()];
        assert_eq!(detect_date_format(&s).unwrap(), DateFormat::MmmYyyy);
    }

    #[test]
    fn test_detect_mmm_dash_yyyy() {
        let s = vec!["Jan-2025".to_string(), "Feb-2025".to_string()];
        assert_eq!(detect_date_format(&s).unwrap(), DateFormat::MmmDashYyyy);
    }

    #[test]
    fn test_detect_mmmm_yyyy() {
        let s = vec!["January 2025".to_string(), "February 2025".to_string()];
        assert_eq!(detect_date_format(&s).unwrap(), DateFormat::MmmmYyyy);
    }

    #[test]
    fn test_detect_dd_mmm_yyyy_dash() {
        let s = vec!["01-Jan-2025".to_string(), "15-Mar-2025".to_string()];
        assert_eq!(detect_date_format(&s).unwrap(), DateFormat::DdMmmYyyyDash);
    }

    #[test]
    fn test_detect_dd_mmm_yyyy_space() {
        let s = vec!["01 Jan 2025".to_string(), "15 Mar 2025".to_string()];
        assert_eq!(detect_date_format(&s).unwrap(), DateFormat::DdMmmYyyySpace);
    }

    #[test]
    fn test_detect_mm_dd_yyyy_dash() {
        // month=01 day=15 unambiguous — month=15 would be invalid for DD-MM-YYYY
        let s = vec!["01-15-2025".to_string(), "03-20-2025".to_string()];
        assert_eq!(detect_date_format(&s).unwrap(), DateFormat::MmDdYyyyDash);
    }

    // ── DateFormat::parse: year-month formats produce day = 1 ───────────

    #[test]
    fn test_parse_yyyy_mm_maps_to_day_1() {
        assert_eq!(
            DateFormat::YyyyMm.parse("2025-01").unwrap().to_string(),
            "2025-01-01"
        );
        assert_eq!(
            DateFormat::YyyyMm.parse("2025-12").unwrap().to_string(),
            "2025-12-01"
        );
    }

    #[test]
    fn test_parse_mm_yyyy_slash_maps_to_day_1() {
        assert_eq!(
            DateFormat::MmYyyySlash.parse("01/2025").unwrap().to_string(),
            "2025-01-01"
        );
    }

    #[test]
    fn test_parse_yyyy_mm_slash_maps_to_day_1() {
        assert_eq!(
            DateFormat::YyyyMmSlash.parse("2025/01").unwrap().to_string(),
            "2025-01-01"
        );
    }

    #[test]
    fn test_parse_mmm_yyyy_maps_to_day_1() {
        assert_eq!(
            DateFormat::MmmYyyy.parse("Jan 2025").unwrap().to_string(),
            "2025-01-01"
        );
    }

    #[test]
    fn test_parse_mmm_dash_yyyy_maps_to_day_1() {
        assert_eq!(
            DateFormat::MmmDashYyyy.parse("Jan-2025").unwrap().to_string(),
            "2025-01-01"
        );
    }

    #[test]
    fn test_parse_mmmm_yyyy_maps_to_day_1() {
        assert_eq!(
            DateFormat::MmmmYyyy.parse("January 2025").unwrap().to_string(),
            "2025-01-01"
        );
    }

    // ── Integration: exact values from the file that triggered the error ─

    #[test]
    fn test_failing_file_period_values() {
        // Actual `Period` column values from the 6309-row file
        let samples = vec![
            "2025-05".to_string(),
            "2025-04".to_string(),
            "2025-09".to_string(),
            "2025-10".to_string(),
            "2025-07".to_string(),
        ];
        let fmt = detect_date_format(&samples).expect("should detect YYYY-MM");
        assert_eq!(fmt, DateFormat::YyyyMm, "format should be YyyyMm");

        let expected = [
            ("2025-05", "2025-05-01"),
            ("2025-04", "2025-04-01"),
            ("2025-09", "2025-09-01"),
            ("2025-10", "2025-10-01"),
            ("2025-07", "2025-07-01"),
        ];
        for (input, expected_iso) in expected {
            let d = fmt.parse(input).expect("should parse");
            assert_eq!(
                d.to_string(),
                expected_iso,
                "parse('{}') should be '{}'",
                input,
                expected_iso
            );
        }
    }

    // ── Blank samples are ignored during detection ───────────────────────

    #[test]
    fn test_blank_samples_skipped() {
        let s = vec!["".to_string(), "  ".to_string(), "2025-01".to_string()];
        assert_eq!(detect_date_format(&s).unwrap(), DateFormat::YyyyMm);
    }

    // ── YYYY-MM-DD is not confused with YYYY-MM ──────────────────────────

    #[test]
    fn test_yyyy_mm_dd_not_confused_with_yyyy_mm() {
        let s = vec!["2025-01-15".to_string(), "2025-06-30".to_string()];
        assert_eq!(detect_date_format(&s).unwrap(), DateFormat::YyyyMmDd);
    }
}
