use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use chrono::{DateTime, Utc};
use uuid::Uuid;

fn remove_duckdb_wal(path: &Path) {
    let mut wal_os = path.as_os_str().to_os_string();
    wal_os.push(".wal");
    let wal = PathBuf::from(wal_os);
    
    if wal.exists() {
        let _ = fs::remove_file(wal);
    }
}

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
    delete_tokens: Mutex<HashMap<String, String>>,
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
            delete_tokens: Mutex::new(HashMap::new()),
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

        workspaces.push(workspace.clone());
        self.save_workspaces(&workspaces)?;

        // Initialize DB schema for this new workspace synchronously
        // This prevents race conditions from concurrent frontend data fetches.
        crate::db::connection::open_connection(&workspace.db_path).map_err(|e| WorkspaceError::Io(std::io::Error::other(e.to_string())))?;

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

    pub fn request_delete(&self, id: &str) -> Result<String, WorkspaceError> {
        let workspaces = self.list_workspaces()?;
        if !workspaces.iter().any(|w| w.id == id) {
            return Err(WorkspaceError::NotFound(id.to_string()));
        }

        let token = Uuid::new_v4().to_string();
        let mut tokens = self.delete_tokens.lock().unwrap();
        tokens.insert(token.clone(), id.to_string());
        
        Ok(token)
    }

    pub fn confirm_delete(&self, token: &str) -> Result<(), WorkspaceError> {
        let id = {
            let mut tokens = self.delete_tokens.lock().unwrap();
            tokens.remove(token).ok_or(WorkspaceError::InvalidDeleteToken)?
        };

        let mut workspaces = self.list_workspaces()?;
        let pos = workspaces.iter().position(|w| w.id == id)
            .ok_or_else(|| WorkspaceError::NotFound(id.clone()))?;
        
        let ws = workspaces.remove(pos);
        self.save_workspaces(&workspaces)?;
        
        if ws.db_path.exists() {
            let _ = fs::remove_file(&ws.db_path);
        }
        remove_duckdb_wal(&ws.db_path);
        
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
    fn test_delete_roundtrip() {
        let dir = get_test_dir();
        let manager = WorkspaceManager::new(&dir).unwrap();
        
        let ws = manager.create_workspace("Test").unwrap();
        
        // 1. Delete confirm with fake token fails
        assert!(matches!(manager.confirm_delete("fake_token"), Err(WorkspaceError::InvalidDeleteToken)));
        
        // 2. Request delete
        let token = manager.request_delete(&ws.id).unwrap();
        
        // 3. Confirm delete
        manager.confirm_delete(&token).unwrap();
        
        // 4. Verify gone
        let list = manager.list_workspaces().unwrap();
        assert_eq!(list.len(), 1);
        
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

        let token = manager.request_delete(&ws.id).unwrap();
        manager.confirm_delete(&token).unwrap();

        assert!(!ws.db_path.exists(), "Workspace DB file should be removed");
        assert!(!wal1.exists(), "DuckDB WAL should be removed");

        let _ = fs::remove_dir_all(&dir);
    }
}
