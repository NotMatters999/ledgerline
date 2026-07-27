use duckdb::{Connection, Result};

const INITIAL_SCHEMA: &str = include_str!("../../migrations/0001_initial_schema.sql");
const MONTHLY_ASSUMPTIONS: &str = include_str!("../../migrations/0002_monthly_assumptions.sql");
const ADD_CATEGORY: &str = include_str!("../../migrations/0003_add_category.sql");
const REPAIR_SCHEMA: &str = include_str!("../../migrations/0004_repair_schema.sql");

struct Migration {
    version: i32,
    script: &'static str,
}

const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        script: INITIAL_SCHEMA,
    },
    Migration {
        version: 2,
        script: MONTHLY_ASSUMPTIONS,
    },
    Migration {
        version: 3,
        script: ADD_CATEGORY,
    },
    Migration {
        version: 4,
        script: REPAIR_SCHEMA,
    },
];

pub fn run_migrations(conn: &mut Connection) -> Result<()> {
    // Check if schema_version exists
    let mut stmt = conn.prepare(
        "SELECT count(*) FROM information_schema.tables WHERE LOWER(table_name) = 'schema_version'"
    )?;
    
    let table_exists: i64 = stmt.query_row([], |row| row.get(0))?;
    
    let mut current_version = 0;
    if table_exists > 0 {
        let mut stmt = conn.prepare("SELECT MAX(version) FROM schema_version")?;
        // DuckDB might return NULL if table is empty, unwrap_or(0) handles it
        current_version = stmt.query_row([], |row| {
            let val: Option<i32> = row.get(0)?;
            Ok(val.unwrap_or(0))
        })?;
    } else {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);",
            []
        )?;
    }

    // Run pending migrations
    for migration in MIGRATIONS {
        if migration.version > current_version {
            let tx = conn.transaction()?;
            tx.execute_batch(migration.script)?;
            tx.execute(
                "INSERT INTO schema_version (version) VALUES (?)",
                [migration.version],
            )?;
            tx.commit()?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migrations_create_tables() {
        let mut conn = Connection::open_in_memory().unwrap();
        run_migrations(&mut conn).expect("Failed to run migrations");

        // Verify tables exist
        let tables = vec![
            "mrr_log", "customers", "monthly_assumptions",
            "settings", "import_history", "schema_version"
        ];
        
        for table in tables {
            let mut stmt = conn.prepare(
                "SELECT count(*) FROM information_schema.tables WHERE table_name = ?"
            ).unwrap();
            let count: i64 = stmt.query_row([table], |row| row.get(0)).unwrap();
            assert_eq!(count, 1, "Table {} missing", table);
        }
    }

    #[test]
    fn test_migrations_are_idempotent() {
        let mut conn = Connection::open_in_memory().unwrap();
        run_migrations(&mut conn).expect("Failed to run migrations first time");
        run_migrations(&mut conn).expect("Failed to run migrations second time");
        
        let mut stmt = conn.prepare("SELECT MAX(version) FROM schema_version").unwrap();
        let version: i32 = stmt.query_row([], |row| row.get(0)).unwrap();
        assert_eq!(version, 4);
    }
}
