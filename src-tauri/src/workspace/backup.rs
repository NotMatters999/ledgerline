use std::fs;
use std::io::ErrorKind;
use std::path::{Component, Path, PathBuf};
use chrono::Utc;
use super::manager::WorkspaceError;

fn remove_duckdb_wal(path: &Path) -> Result<(), WorkspaceError> {
    let candidates = [
        path.with_extension("duckdb.wal"),
        path.with_extension("duckdb-wal"),
    ];

    for wal in candidates {
        match fs::remove_file(&wal) {
            Ok(()) => (),
            Err(err) if err.kind() == ErrorKind::NotFound => (),
            Err(err) => return Err(WorkspaceError::Io(err)),
        }
    }

    Ok(())
}

fn normalize_path(path: &Path) -> Result<PathBuf, std::io::Error> {
    if path.exists() {
        return path.canonicalize();
    }

    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => (),
            Component::ParentDir => {
                normalized.pop();
            }
            other => normalized.push(other.as_os_str()),
        }
    }

    Ok(normalized)
}

pub struct BackupManager {
    pub app_data_dir: PathBuf,
}

impl BackupManager {
    pub fn new<P: AsRef<Path>>(app_data_dir: P) -> Self {
        Self {
            app_data_dir: app_data_dir.as_ref().to_path_buf(),
        }
    }

    pub fn backup(&self, db_path: &Path, workspace_id: &str) -> Result<PathBuf, WorkspaceError> {
        let backups_dir = self.app_data_dir.join("backups").join(workspace_id);
        fs::create_dir_all(&backups_dir)?;
        
        let now = Utc::now().format("%Y%m%d_%H%M%S");
        let backup_file = backups_dir.join(format!("{}.duckdb.bak", now));
        
        fs::copy(db_path, &backup_file)?;
        
        // Retention policy: Keep only the 5 most recent backups
        if let Ok(entries) = fs::read_dir(&backups_dir) {
            let mut files: Vec<PathBuf> = entries
                .filter_map(Result::ok)
                .map(|e| e.path())
                .filter(|p| p.is_file() && p.extension().is_some_and(|ext| ext == "bak"))
                .collect();
            
            // Sort by modification time, newest first
            files.sort_by(|a, b| {
                let meta_a = a.metadata().and_then(|m| m.modified()).unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                let meta_b = b.metadata().and_then(|m| m.modified()).unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                meta_b.cmp(&meta_a)
            });
            
            // Delete anything beyond the 5th file
            for file_to_delete in files.iter().skip(5) {
                let _ = fs::remove_file(file_to_delete);
            }
        }
        
        Ok(backup_file)
    }

    pub fn list_backups(&self, workspace_id: &str) -> Result<Vec<String>, WorkspaceError> {
        let backups_dir = self.app_data_dir.join("backups").join(workspace_id);
        if !backups_dir.exists() {
            return Ok(Vec::new());
        }
        
        let mut files: Vec<String> = Vec::new();
        if let Ok(entries) = fs::read_dir(&backups_dir) {
            for entry in entries.filter_map(Result::ok) {
                let path = entry.path();
                if path.is_file() && path.extension().is_some_and(|ext| ext == "bak") {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        files.push(name.to_string());
                    }
                }
            }
        }
        // Sort descending (newest first) based on timestamp in filename
        files.sort_by(|a, b| b.cmp(a));
        Ok(files)
    }

    pub fn restore(&self, backup_path: &Path, target_db_path: &Path) -> Result<(), WorkspaceError> {
        let backup_path_norm = normalize_path(backup_path).map_err(WorkspaceError::Io)?;
        let target_path_norm = normalize_path(target_db_path).map_err(WorkspaceError::Io)?;

        if backup_path_norm == target_path_norm {
            return Err(WorkspaceError::Io(std::io::Error::new(
                ErrorKind::InvalidInput,
                "backup_path and target_db_path must be distinct",
            )));
        }

        // Delete any stale WAL files before restoring to avoid DuckDB replay issues.
        remove_duckdb_wal(target_db_path)?;

        if target_db_path.exists() {
            let _ = fs::remove_file(target_db_path);
        }

        fs::copy(backup_path, target_db_path)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn get_test_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ledgerline_backup_test_{}", Utc::now().timestamp_nanos_opt().unwrap_or(0)));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn test_restore_cleans_up_duckdb_wal_files() {
        let dir = get_test_dir();
        fs::create_dir_all(&dir).unwrap();

        let source_db = dir.join("source.duckdb");
        let target_db = dir.join("target.duckdb");
        fs::write(&source_db, "db").unwrap();
        fs::write(&target_db, "old").unwrap();
        fs::write(target_db.with_extension("duckdb.wal"), "wal").unwrap();
        fs::write(target_db.with_extension("duckdb-wal"), "wal").unwrap();

        let manager = BackupManager::new(&dir);
        manager.restore(&source_db, &target_db).unwrap();

        assert!(target_db.exists());
        let source_bytes = fs::read(&source_db).unwrap();
        let target_bytes = fs::read(&target_db).unwrap();
        assert_eq!(target_bytes, source_bytes, "Restored target DB bytes must match the source backup file");
        assert!(!target_db.with_extension("duckdb.wal").exists());
        assert!(!target_db.with_extension("duckdb-wal").exists());

        let _ = fs::remove_dir_all(&dir);
    }
}
