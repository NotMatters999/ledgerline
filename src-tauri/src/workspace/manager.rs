use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub last_accessed: DateTime<Utc>,
    pub db_path: PathBuf,
}

#[derive(Debug, thiserror::Error)]
pub enum WorkspaceError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Path traversal detected: {0}")]
    PathTraversal(String),
    #[error("Workspace not found: {0}")]
    NotFound(String),
    #[error("Invalid delete token")]
    InvalidDeleteToken,
}

// Implement Serialize manually or let serde derive it if we map the errors to strings over IPC later
impl serde::Serialize for WorkspaceError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub struct WorkspaceManager {
    workspaces_json_path: PathBuf,
    workspaces_dir: PathBuf,
}

impl WorkspaceManager {
    pub fn new<P: AsRef<Path>>(app_data_dir: P) -> Result<Self, WorkspaceError> {
        let app_data_dir = app_data_dir.as_ref().to_path_buf();
        let workspaces_json_path = app_data_dir.join("workspaces.json");
        let workspaces_dir = app_data_dir.join("workspaces");

        if !workspaces_dir.exists() {
            fs::create_dir_all(&workspaces_dir)?;
        }

        let is_new = !workspaces_json_path.exists();
        if is_new {
            let empty: Vec<Workspace> = Vec::new();
            let json = serde_json::to_string_pretty(&empty)?;
            fs::write(&workspaces_json_path, json)?;
        }

        let manager = Self {
            workspaces_json_path,
            workspaces_dir,
        };

        if is_new {
            let _ = manager.create_workspace("Default Workspace");
        }

        Ok(manager)
    }

    fn ensure_safe_path(&self, requested_filename: &str) -> Result<PathBuf, WorkspaceError> {
        if requested_filename.contains('/') || requested_filename.contains('\\') || requested_filename.contains("..") {
            return Err(WorkspaceError::PathTraversal("Invalid filename characters".into()));
        }
        
        let path = self.workspaces_dir.join(requested_filename);
        Ok(path)
    }

    pub fn list_workspaces(&self) -> Result<Vec<Workspace>, WorkspaceError> {
        let data = fs::read_to_string(&self.workspaces_json_path)?;
        let workspaces: Vec<Workspace> = serde_json::from_str(&data)?;
        Ok(workspaces)
    }

    fn save_workspaces(&self, workspaces: &[Workspace]) -> Result<(), WorkspaceError> {
        let json = serde_json::to_string_pretty(workspaces)?;
        fs::write(&self.workspaces_json_path, json)?;
        Ok(())
    }

    pub fn create_workspace(&self, name: &str) -> Result<Workspace, WorkspaceError> {
        let id = Uuid::new_v4().to_string();
        let filename = format!("{}.duckdb", id);
        let db_path = self.ensure_safe_path(&filename)?;

        let mut workspaces = self.list_workspaces()?;
        
        let now = Utc::now();
        let workspace = Workspace {
            id: id.clone(),
            name: name.to_string(),
            created_at: now,
            last_accessed: now,
            db_path,
        };

        // Initialize DB schema for this new workspace synchronously
        // This prevents race conditions from concurrent frontend data fetches.
        crate::db::connection::open_connection(&workspace.db_path, Some(&workspace.id))
            .map_err(|e| WorkspaceError::Io(std::io::Error::other(e.to_string())))?;

        // Only persist to workspaces.json after successful DB creation and migration
        workspaces.push(workspace.clone());
        self.save_workspaces(&workspaces)?;

        Ok(workspace)
    }

    pub fn rename_workspace(&self, id: &str, new_name: &str) -> Result<Workspace, WorkspaceError> {
        let mut workspaces = self.list_workspaces()?;
        
        if let Some(ws) = workspaces.iter_mut().find(|w| w.id == id) {
            ws.name = new_name.to_string();
            let ret = ws.clone();
            self.save_workspaces(&workspaces)?;
            return Ok(ret);
        }
        
        Err(WorkspaceError::NotFound(id.to_string()))
    }
    
    pub fn mark_accessed(&self, id: &str) -> Result<Workspace, WorkspaceError> {
        let mut workspaces = self.list_workspaces()?;
        
        if let Some(ws) = workspaces.iter_mut().find(|w| w.id == id) {
            ws.last_accessed = Utc::now();
            let ret = ws.clone();
            self.save_workspaces(&workspaces)?;
            return Ok(ret);
        }
        
        Err(WorkspaceError::NotFound(id.to_string()))
    }

    pub fn delete_workspace(&self, id: &str) -> Result<(), WorkspaceError> {
        let mut workspaces = self.list_workspaces()?;
        let pos = workspaces.iter().position(|w| w.id == id)
            .ok_or_else(|| WorkspaceError::NotFound(id.to_string()))?;
        
        let ws = &workspaces[pos];
        
        if ws.db_path.exists() {
            fs::remove_file(&ws.db_path).map_err(|e| WorkspaceError::Io(e))?;
        }
        
        let mut wal_os = ws.db_path.as_os_str().to_os_string();
        wal_os.push(".wal");
        let wal = PathBuf::from(wal_os);
        if wal.exists() {
            fs::remove_file(wal).map_err(|e| WorkspaceError::Io(e))?;
        }
        
        workspaces.remove(pos);
        self.save_workspaces(&workspaces)?;
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn get_test_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ledgerline_test_{}", Uuid::new_v4()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn test_path_isolation() {
        let dir = get_test_dir();
        let manager = WorkspaceManager::new(&dir).unwrap();
        
        let bad_paths = [
            "../../../etc/shadow",
            "..\\..\\windows\\system32",
            "some/path.duckdb",
        ];

        for path in bad_paths {
            let res = manager.ensure_safe_path(path);
            assert!(matches!(res, Err(WorkspaceError::PathTraversal(_))), "Path {} should be rejected", path);
        }
        
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_delete_workspace() {
        let dir = get_test_dir();
        let manager = WorkspaceManager::new(&dir).unwrap();
        
        let ws = manager.create_workspace("Test").unwrap();
        
        // 2. Request delete is now handled by tokens separately, so just call delete_workspace
        manager.delete_workspace(&ws.id).unwrap();
        
        // 4. Verify gone
        let list = manager.list_workspaces().unwrap();
        assert_eq!(list.len(), 0);
        
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_confirm_delete_removes_duckdb_wal_files() {
        let dir = get_test_dir();
        let manager = WorkspaceManager::new(&dir).unwrap();
        let ws = manager.create_workspace("Test WAL Cleanup").unwrap();

        // Create a dummy database and WAL variants.
        let _ = fs::create_dir_all(ws.db_path.parent().unwrap());
        fs::write(&ws.db_path, "dummy").unwrap();
        let wal1 = {
            let mut s = ws.db_path.as_os_str().to_os_string();
            s.push(".wal");
            PathBuf::from(s)
        };
        fs::write(&wal1, "wal").unwrap();

        manager.delete_workspace(&ws.id).unwrap();

        assert!(!ws.db_path.exists(), "Workspace DB file should be removed");
        assert!(!wal1.exists(), "DuckDB WAL should be removed");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_delete_workspace_preserves_metadata_on_failure() {
        let dir = get_test_dir();
        let manager = WorkspaceManager::new(&dir).unwrap();
        let mut ws = manager.create_workspace("Test Failure").unwrap();
        
        // Sabotage the DB path to point to a directory, which fs::remove_file will refuse to delete
        let bad_path = dir.join("unwritable_dir");
        fs::create_dir(&bad_path).unwrap();
        
        ws.db_path = bad_path.clone();
        
        // Manually update the JSON so the manager sees the bad path
        let mut workspaces = manager.list_workspaces().unwrap();
        let pos = workspaces.iter().position(|w| w.id == ws.id).unwrap();
        workspaces[pos] = ws.clone();
        manager.save_workspaces(&workspaces).unwrap();
        
        // Attempt delete
        let res = manager.delete_workspace(&ws.id);
        assert!(matches!(res, Err(WorkspaceError::Io(_))), "Should return IO error because remove_file on a directory fails");
        
        // Verify JSON still has the workspace
        let list = manager.list_workspaces().unwrap();
        assert_eq!(list.len(), 1, "Workspace entry must NOT be deleted if file deletion fails");
        
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_create_workspace_rollback_on_migration_failure() {
        let dir = get_test_dir();
        let manager = WorkspaceManager::new(&dir).unwrap();
        
        let initial_list = manager.list_workspaces().unwrap();
        assert_eq!(initial_list.len(), 1, "Should have only Default Workspace initially");
        
        // Sabotage by deleting the workspaces directory and creating a FILE in its place.
        // This will guarantee that `Connection::open` inside `create_workspace` fails,
        // because it cannot create a `.duckdb` file inside another file.
        let workspaces_dir = dir.join("workspaces");
        fs::remove_dir_all(&workspaces_dir).unwrap();
        fs::write(&workspaces_dir, "not a directory").unwrap();
        
        // Attempt create
        let res = manager.create_workspace("Test Rollback");
        assert!(res.is_err(), "Creation should fail due to IO error");
        
        // Verify JSON has NO NEW entries
        let list = manager.list_workspaces().unwrap();
        assert_eq!(list.len(), 1, "workspaces.json should not contain the failed workspace");
        assert_eq!(list[0].id, initial_list[0].id, "Only the default workspace should remain");
        
        // Clean up our sabotage so the directory can be deleted
        let _ = fs::remove_file(&workspaces_dir);
        let _ = fs::remove_dir_all(&dir);
    }
}
