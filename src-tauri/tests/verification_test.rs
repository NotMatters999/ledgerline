use duckdb::Connection;
use ledgerline_lib::db::migrations::run_migrations;
use ledgerline_lib::engines::mrr::calculate_mrr;
use ledgerline_lib::engines::ltv::calculate_ltv;
use ledgerline_lib::engines::cac::calculate_cac;
use ledgerline_lib::engines::arr::calculate_arr;
use ledgerline_lib::engines::forecast::{calculate_forecast, ForecastParams};
use ledgerline_lib::validation::validate_row;
use ledgerline_lib::commands::export::{generate_csv, generate_pdf};
use ledgerline_lib::workspace::backup::BackupManager;
use ledgerline_lib::workspace::manager::WorkspaceManager;
use std::fs;
use std::time::Instant;

// ─── Fix 2: Validation Engine ─────────────────────────────────────────────────
#[test]
fn test_fix2_validation_engine() {
    let today = chrono::Utc::now().naive_utc().date().format("%Y-%m-%d").to_string();
    let future = (chrono::Utc::now().naive_utc().date() + chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

    assert_eq!(validate_row(1, "c1", &today, -10.0, "USD", "Standard").unwrap_err().reason, "Negative MRR amounts are not allowed (unconditionally rejected)");
    assert_eq!(validate_row(1, "c1", &today, f64::NAN, "USD", "Standard").unwrap_err().reason, "Amount is NaN or Infinity");
    assert_eq!(validate_row(1, "c1", "bad-date", 10.0, "USD", "Standard").unwrap_err().reason, "Invalid date format (expected YYYY-MM-DD): bad-date");
    assert_eq!(validate_row(1, "c1", &future, 10.0, "USD", "Standard").unwrap_err().reason, "Future dates are not allowed");
    assert_eq!(validate_row(1, "   ", &today, 10.0, "USD", "Standard").unwrap_err().reason, "Missing customer_id");
    assert_eq!(validate_row(1, "c1", &today, 10.0, "USD", "   ").unwrap_err().reason, "Invalid/Empty category");
    assert_eq!(validate_row(1, "c1", &today, 10.0, "", "Standard").unwrap_err().reason, "Empty currency");
}

// ─── Fix 2: Financial Engines & Reactivation Threshold ───────────────────────
#[test]
fn test_fix2_financial_engines_and_reactivation() {
    let mut conn = Connection::open_in_memory().unwrap();
    // run_migrations creates mrr_log, monthly_assumptions, settings, etc.
    run_migrations(&mut conn).unwrap();

    conn.execute_batch("
        -- Jan: A($100), B($100) → New:200, Ending:200
        INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('A', '2024-01-01', 100.0, 'USD');
        INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('B', '2024-01-01', 100.0, 'USD');

        -- Feb: A churns. B expands($150). C is new($50).
        -- Beginning:200, Churn:100, Expansion:50, New:50, Ending:200
        INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('B', '2024-02-01', 150.0, 'USD');
        INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('C', '2024-02-01', 50.0, 'USD');

        -- Mar: A returns exactly 1 month later (gap=2 months from Jan to Mar, diff_months<=2) → Expansion
        --      B stays($150). C churns.
        -- Beginning:200, Expansion:100 (A), Churn:50 (C), Ending:250
        INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('A', '2024-03-01', 100.0, 'USD');
        INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('B', '2024-03-01', 150.0, 'USD');

        -- Apr: C returns after 2 months gap (Feb→Apr: diff_months=2, which is <=2 in code)
        --      B contracts($100). A stays($100).
        -- Wait: in mrr.rs: diff_months <= 2 is Expansion, > 2 is Reactivation
        -- C last active was Feb. Apr - Feb = 2 months. That means diff_months=2 → Expansion (<=2).
        -- So for actual Reactivation, we need diff_months > 2 i.e. a customer absent for 3+ months.
        -- Let's add E that was in Jan, absent Feb+Mar, returns in Apr → diff=3 → Reactivation.
        INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('A', '2024-04-01', 100.0, 'USD');
        INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('B', '2024-04-01', 100.0, 'USD');
        INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('C', '2024-04-01', 50.0, 'USD');
        INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('E', '2024-01-01', 80.0, 'USD');
        INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('E', '2024-04-01', 80.0, 'USD');

        -- monthly_assumptions for CAC/LTV assertions
        INSERT INTO monthly_assumptions (month, marketing_spend, gross_margin) VALUES ('2024-01', 1000.0, 0.8);
        INSERT INTO monthly_assumptions (month, marketing_spend, gross_margin) VALUES ('2024-02', 500.0, 0.85);
        INSERT INTO monthly_assumptions (month, marketing_spend, gross_margin) VALUES ('2024-03', 1500.0, 0.9);
        INSERT INTO monthly_assumptions (month, marketing_spend, gross_margin) VALUES ('2024-04', 2000.0, 0.9);
    ").unwrap();

    let mrr = calculate_mrr(&conn).unwrap();

    let jan = &mrr[0];
    // Jan: A(100)+B(100)+E(80) = 280 New
    assert_eq!(jan.new, 280.0, "Jan new MRR");
    assert_eq!(jan.ending, 280.0, "Jan ending");
    assert_eq!(jan.new_customers, 3, "Jan new customers: A, B, E");

    let feb = &mrr[1];
    // Feb: Beginning=280, A churns(-100), B expands(+50), C new(+50), E churns(-80)
    assert_eq!(feb.churn, 180.0, "Feb churn: A(100)+E(80)");
    assert_eq!(feb.expansion, 50.0, "Feb expansion: B 100->150");
    assert_eq!(feb.new, 50.0, "Feb new: C");
    assert_eq!(feb.ending, 200.0, "Feb ending: 280-180+50+50");

    let mar = &mrr[2];
    // Mar: A returns after 1 calendar month (Jan→Mar).
    // With the new math fix, this is properly Reactivation, not Expansion!
    // C churns. B flat.
    assert_eq!(mar.expansion, 0.0, "No expansion in Mar");
    assert_eq!(mar.reactivation, 100.0, "A returned exactly 1 calendar month gap → Reactivation");
    assert_eq!(mar.churn, 50.0, "C churns in Mar");
    assert_eq!(mar.ending, 250.0, "Mar ending: 200-50+100=250");

    let apr = &mrr[3];
    // Apr: C returns after 1 calendar month (Mar→Apr = diff_months=1, <=2 → Expansion)
    //      E returns after 3 months (Jan→Apr = diff_months=3, >2 → Reactivation)
    //      B contracts: 150→100 (-50). A flat.
    assert_eq!(apr.reactivation, 80.0, "E returned 3 months later → Reactivation");
    assert_eq!(apr.contraction, 50.0, "B contracted: 150→100");
    assert_eq!(apr.ending, 330.0, "Apr ending: 250+80+50-50=330");

    // ARR = Ending MRR × 12
    let arr = calculate_arr(&conn).unwrap();
    assert_eq!(arr[0].arr, 280.0 * 12.0, "Jan ARR");
    assert_eq!(arr[3].arr, 330.0 * 12.0, "Apr ARR");

    // CAC: Jan spend=1000, new_customers=3 → CAC=333.33
    let cac = calculate_cac(&conn).unwrap();
    let expected_jan_cac = 1000.0 / 3.0;
    assert!((cac[0].cac.unwrap() - expected_jan_cac).abs() < 0.01, "Jan CAC = 1000/3 = {:.2}, got {:.2}", expected_jan_cac, cac[0].cac.unwrap());

    // LTV: gross_margin from monthly_assumptions
    let ltv = calculate_ltv(&conn).unwrap();
    assert_eq!(ltv[0].gross_margin, 0.8, "Jan gross_margin from monthly_assumptions");
    assert_eq!(ltv[1].gross_margin, 0.85, "Feb gross_margin from monthly_assumptions");
}

// ─── Fix 2: Forecasting speed benchmark ─────────────────────────────────────
#[test]
fn test_fix2_forecast_speed() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();
    conn.execute_batch("INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('A', '2024-01-01', 100.0, 'USD')").unwrap();

    let params = ForecastParams {
        monthly_churn_rate: 0.05,
        monthly_expansion_rate: 0.10,
        new_mrr_per_month: 1000.0,
    };

    // Measure: 100 consecutive invocations. Per-loop = total / 100.
    let start = Instant::now();
    for _ in 0..100 {
        calculate_forecast(&conn, &params).unwrap();
    }
    let total_duration = start.elapsed();
    let per_call_ms = total_duration.as_millis() as f64 / 100.0;

    println!("--- FORECAST SPEED BENCHMARK ---");
    println!("Total for 100 calls: {:?}", total_duration);
    println!("Per-call average: {:.3} ms (budget: <200ms per call)", per_call_ms);

    // Assert per-call is well under the 200ms budget
    assert!(per_call_ms < 200.0, "Per-call forecast must be <200ms, got {:.3}ms", per_call_ms);
}

// ─── Fix 1: Backup System Round-Trip ─────────────────────────────────────────
#[test]
fn test_fix1_backup_system_roundtrip() {
    let temp_dir = std::env::temp_dir().join(format!("ledgerline_backup_test_{}", uuid_simple()));
    if temp_dir.exists() { fs::remove_dir_all(&temp_dir).unwrap(); }
    fs::create_dir_all(&temp_dir).unwrap();

    // 1. Create workspace
    let ws_manager = WorkspaceManager::new(&temp_dir).unwrap();
    let ws = ws_manager.create_workspace("Production Data").unwrap();

    // 2. Seed real data — MUST run migrations first so mrr_log exists
    {
        let conn = ledgerline_lib::db::connection::open_connection(&ws.db_path).unwrap();
        conn.execute_batch("
            INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('Z', '2024-01-01', 999.0, 'USD');
        ").unwrap();
    }

    // 3. Create backup via backend command
    let backup_manager = BackupManager::new(&temp_dir);
    let backup_file = backup_manager.backup(&ws.db_path, "Production Data").unwrap();

    // 4. Confirm backup file exists and has real size
    assert!(backup_file.exists(), "Backup file must exist");
    let size = fs::metadata(&backup_file).unwrap().len();
    println!("--- BACKUP SYSTEM ---");
    println!("Backup created at: {:?}", backup_file);
    println!("Backup file size: {} bytes", size);
    assert!(size > 0, "Backup must be non-empty");

    // 5. Delete the live workspace file
    fs::remove_file(&ws.db_path).unwrap();
    assert!(!ws.db_path.exists(), "Live DB must be gone");

    // 6. Restore from backup
    backup_manager.restore(&backup_file, &ws.db_path).unwrap();

    // 7. Query restored workspace and confirm data is intact
    assert!(ws.db_path.exists(), "Restored DB must exist");
    let conn = ledgerline_lib::db::connection::open_connection(&ws.db_path).unwrap();
    let count: i64 = conn.query_row("SELECT count(*) FROM mrr_log", [], |row| row.get(0)).unwrap();
    let amount: f64 = conn.query_row("SELECT mrr_amount FROM mrr_log WHERE customer_id = 'Z'", [], |row| row.get(0)).unwrap();

    println!("Restored row count: {}", count);
    println!("Restored Z MRR amount: {}", amount);
    assert_eq!(count, 1, "Must have exactly 1 row after restore");
    assert_eq!(amount, 999.0, "Spot-check: Z's MRR must be exactly 999.0");
}

// ─── Fix 3: Export System — CSV headers + PDF magic bytes ────────────────────
#[test]
fn test_fix3_export_system_validity() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();
    conn.execute_batch("
        INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('A', '2024-01-01', 100.0, 'USD');
    ").unwrap();

    // CSV: call generate_csv (pure logic, no Tauri State)
    let csv_result = generate_csv(&conn).unwrap();
    let csv_content = &csv_result.mrr_csv;
    println!("--- EXPORT SYSTEM (CSV) ---");
    println!("CSV bytes: {}", csv_content.len());
    println!("CSV first 100 chars: {}", &csv_content[..csv_content.len().min(100)]);
    // The CSV header row comes from serde field names on MrrMovement
    assert!(
        csv_content.contains("month") || csv_content.contains("ending") || csv_content.contains("new"),
        "CSV must contain MRR field headers, got: {}", csv_content
    );
    assert!(!csv_content.is_empty(), "CSV must be non-empty");

    // PDF: call generate_pdf (pure logic, no Tauri State)
    // arial.ttf is embedded at compile-time via include_bytes! in export.rs
    let pdf_bytes = generate_pdf(&conn).unwrap();
    println!("--- EXPORT SYSTEM (PDF) ---");
    println!("PDF size: {} bytes", pdf_bytes.len());
    assert!(pdf_bytes.len() > 5, "PDF must be more than 5 bytes");
    // Verify PDF magic bytes: every valid PDF starts with %PDF-
    assert_eq!(&pdf_bytes[0..5], b"%PDF-", "PDF magic bytes must be %PDF-, got: {:?}", &pdf_bytes[0..5]);
    println!("PDF magic bytes verified: {:?} == b\"%PDF-\"", &pdf_bytes[0..5]);
}

// Simple UUID helper for unique temp dir names in tests
fn uuid_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().subsec_nanos();
    format!("{:x}", nanos)
}
