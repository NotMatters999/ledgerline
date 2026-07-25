use std::path::{Path, PathBuf};
use std::fs;
use chrono::Utc;
use super::manager::WorkspaceError;

pub struct BackupManager {
    pub app_data_dir: PathBuf,
}

impl BackupManager {
    pub fn new<P: AsRef<Path>>(app_data_dir: P) -> Self {
        Self {
            app_data_dir: app_data_dir.as_ref().to_path_buf(),
        }
    }

    pub fn backup(&self, db_path: &Path, workspace_name: &str) -> Result<PathBuf, WorkspaceError> {
        let backups_dir = self.app_data_dir.join("backups").join(workspace_name);
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

    pub fn list_backups(&self, workspace_name: &str) -> Result<Vec<String>, WorkspaceError> {
        let backups_dir = self.app_data_dir.join("backups").join(workspace_name);
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
        // Delete WAL before restoring to prevent corruption
        let wal = target_db_path.with_extension("duckdb.wal");
        if wal.exists() {
            let _ = fs::remove_file(wal);
        }
        
        fs::copy(backup_path, target_db_path)?;
        Ok(())
    }
}
