use std::sync::Arc;
use std::thread;
use duckdb::Connection;
use ledgerline_lib::db::migrations::run_migrations;

#[test]
fn test_concurrent_initialization_race() {
    let db_path = std::env::temp_dir().join(format!("ledgerline_race_test_{}.duckdb", uuid::Uuid::new_v4()));
    let db_path_arc = Arc::new(db_path.clone());

    let mut handles = vec![];

    // Spawn 5 concurrent threads all trying to open and migrate the same new file
    for _ in 0..5 {
        let path = Arc::clone(&db_path_arc);
        handles.push(thread::spawn(move || {
            let mut conn = match Connection::open(path.as_path()) {
                Ok(c) => c,
                Err(e) => return format!("Open Error: {}", e),
            };
            match run_migrations(&mut conn) {
                Ok(_) => "Success".to_string(),
                Err(e) => format!("Migration Error: {}", e),
            }
        }));
    }

    let mut results = vec![];
    for handle in handles {
        results.push(handle.join().unwrap());
    }

    // Clean up
    let _ = std::fs::remove_file(&db_path);
    let _ = std::fs::remove_file(db_path.with_extension("duckdb.wal"));

    println!("Concurrent results: {:#?}", results);
    
    // We expect at least one error if DuckDB cannot handle concurrent DDL or throws a transaction conflict
    let has_error = results.iter().any(|r| r != "Success");
    assert!(has_error, "If this doesn't panic, there was NO race condition (DuckDB handled it gracefully). If it panics with 'has_error' false, I must retract the claim!");
}
