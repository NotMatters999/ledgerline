use duckdb::Connection;
use ledgerline::db::migrations::run_migrations;

#[test]
fn test_repair_schema_runs_on_broken_workspace() {
    let mut conn = Connection::open_in_memory().unwrap();
    
    // Simulate a broken workspace that ran the original 0001 schema (which missed mrr_log)
    conn.execute_batch(include_str!("fixtures/broken_schema_setup.sql")).unwrap();

    // Verify mrr_log does NOT exist
    let has_mrr_log: i64 = conn.query_row(
        "SELECT count(*) FROM information_schema.tables WHERE table_name = 'mrr_log'",
        [],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(has_mrr_log, 0);

    // Now run migrations on OPEN (just like the app does)
    run_migrations(&mut conn).unwrap();

    // Verify mrr_log was created by 0004_repair_schema.sql
    let has_mrr_log_now: i64 = conn.query_row(
        "SELECT count(*) FROM information_schema.tables WHERE table_name = 'mrr_log'",
        [],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(has_mrr_log_now, 1, "mrr_log was not created by the repair migration!");

    println!("Repair migration successfully fixed the broken workspace on open!");
}
