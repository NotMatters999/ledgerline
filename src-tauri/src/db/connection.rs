use duckdb::{Connection, Result};
use std::path::Path;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};

static MIGRATED_WORKSPACES: OnceLock<Mutex<HashMap<String, Arc<Mutex<bool>>>>> = OnceLock::new();

pub fn open_connection<P: AsRef<Path>>(db_path: P, workspace_id: Option<&str>) -> Result<Connection> {
    let mut conn = Connection::open(db_path)?;
    
    if let Some(id) = workspace_id {
        let ws_lock = {
            let map_mutex = MIGRATED_WORKSPACES.get_or_init(|| Mutex::new(HashMap::new()));
            let mut map = map_mutex.lock().unwrap();
            map.entry(id.to_string()).or_insert_with(|| Arc::new(Mutex::new(false))).clone()
        };
        
        let mut is_migrated = ws_lock.lock().unwrap();
        if !*is_migrated {
            crate::db::migrations::run_migrations(&mut conn)?;
            *is_migrated = true;
        }
    } else {
        crate::db::migrations::run_migrations(&mut conn)?;
    }
    
    Ok(conn)
}

pub fn invalidate_migration_cache(workspace_id: &str) {
    if let Some(mutex) = MIGRATED_WORKSPACES.get() {
        if let Ok(mut map) = mutex.lock() {
            map.remove(workspace_id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_migration_failure_retry_and_granular_lock() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.duckdb");
        // Use a unique ID to prevent collisions in the global MIGRATED_WORKSPACES map
        let ws_id_str = format!("test_ws_failure_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        let ws_id = ws_id_str.as_str();
        
        // 1. Sabotage the database by creating a schema_version table with bad data
        // This causes `run_migrations` to fail when it queries MAX(version).
        {
            let conn = Connection::open(&db_path).unwrap();
            conn.execute("CREATE TABLE schema_version (version VARCHAR)", []).unwrap();
            conn.execute("INSERT INTO schema_version VALUES ('garbage')", []).unwrap();
        }
        
        // 2. Attempt to open connection, migration should fail
        let res = open_connection(&db_path, Some(ws_id));
        assert!(res.is_err(), "Migration should fail due to sabotaged schema");
        
        // 3. Verify it is NOT cached as successfully migrated
        {
            let map = MIGRATED_WORKSPACES.get().unwrap().lock().unwrap();
            let arc = map.get(ws_id).unwrap();
            let is_migrated = arc.lock().unwrap();
            assert_eq!(*is_migrated, false, "Should not be marked as migrated");
        }
        
        // 4. Fix the sabotage
        {
            let conn = Connection::open(&db_path).unwrap();
            conn.execute("DROP TABLE schema_version", []).unwrap();
        }
        
        // 5. Retry opening connection, migration should now succeed!
        let res = open_connection(&db_path, Some(ws_id));
        assert!(res.is_ok(), "Retry should succeed after fixing the DB");
        
        // 6. Verify it IS now cached as migrated
        {
            let map = MIGRATED_WORKSPACES.get().unwrap().lock().unwrap();
            let arc = map.get(ws_id).unwrap();
            let is_migrated = arc.lock().unwrap();
            assert_eq!(*is_migrated, true, "Should now be marked as migrated");
        }
    }
    
    #[test]
    fn test_concurrent_workspace_migrations_do_not_block() {
        use std::thread;
        use std::time::Duration;
        use std::sync::mpsc;
        
        let dir = tempdir().unwrap();
        let db2_path = dir.path().join("ws2.duckdb");
        
        // Use unique IDs to prevent collisions in the global MIGRATED_WORKSPACES map
        let suffix = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let ws1_id = format!("concurrent_ws1_{}", suffix);
        let ws2_id = format!("concurrent_ws2_{}", suffix);
        
        // 1. Manually acquire and hold ws1's lock (simulating a long-running migration)
        let ws1_arc = {
            let map_mutex = MIGRATED_WORKSPACES.get_or_init(|| Mutex::new(HashMap::new()));
            let mut map = map_mutex.lock().unwrap();
            map.entry(ws1_id.clone()).or_insert_with(|| Arc::new(Mutex::new(false))).clone()
        };
        let _ws1_guard = ws1_arc.lock().unwrap();
        
        let (tx, rx) = mpsc::channel();
        
        // 2. Spawn thread to migrate ws2
        let db2_path_clone = db2_path.clone();
        let ws2_id_clone = ws2_id.clone();
        thread::spawn(move || {
            let res = open_connection(&db2_path_clone, Some(&ws2_id_clone));
            tx.send(res.is_ok()).unwrap();
        });
        
        // 3. Verify ws2 finishes quickly WITHOUT waiting for ws1 to release its lock
        // If they used a global lock, this recv would block until `_ws1_guard` is dropped.
        let ws2_finished_quickly = rx.recv_timeout(Duration::from_secs(2)).unwrap_or(false);
        assert!(ws2_finished_quickly, "Workspace 2 migration was incorrectly blocked by Workspace 1's lock!");
        
        // 4. Clean up lock
        drop(_ws1_guard);
    }
}
