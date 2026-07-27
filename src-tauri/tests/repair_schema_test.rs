use duckdb::Connection;
use ledgerline::db::migrations::run_migrations;

#[test]
fn test_repair_schema_runs_on_broken_workspace() {
    let mut conn = Connection::open_in_memory().unwrap();
    
    // Simulate a broken workspace that ran the original 0001 schema (which missed mrr_log)
    conn.execute_batch("
        CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
        INSERT INTO schema_version (version) VALUES (1);
        CREATE TABLE customers (customer_id VARCHAR PRIMARY KEY, first_seen DATE NOT NULL, status VARCHAR NOT NULL, metadata VARCHAR);
        -- mrr_log is MISSING here!
    ").unwrap();

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
