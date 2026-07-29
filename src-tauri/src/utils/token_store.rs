use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ActionType {
    DeleteWorkspace { id: String },
    RestoreBackup { workspace_id: String, filename: String },
    DeleteMrrRow { workspace_id: String, rowid: i64 },
}

struct TokenEntry {
    action: ActionType,
    created_at: Instant,
}

#[derive(Default)]
pub struct SecureTokenStore {
    tokens: Mutex<HashMap<String, TokenEntry>>,
}

impl SecureTokenStore {
    pub fn new() -> Self {
        Self {
            tokens: Mutex::new(HashMap::new()),
        }
    }

    /// Mints a new token and registers it for a specific ActionType.
    ///
    /// **NOTE (Sweep Timing):**
    /// Expired tokens are evicted *lazily* on the next call to `mint`. 
    /// This means dead tokens remain in memory for >5 minutes if no new tokens are requested, 
    /// but memory is guaranteed to be swept and bounded whenever new allocations happen.
    pub fn mint(&self, action: ActionType) -> String {
        let token = Uuid::new_v4().to_string();
        let mut map = self.tokens.lock().unwrap();
        
        // Eviction sweep: remove any tokens older than 5 minutes to prevent unbounded growth from cancelled flows
        let now = Instant::now();
        map.retain(|_, entry| now.duration_since(entry.created_at) <= Duration::from_secs(300));
        
        map.insert(token.clone(), TokenEntry {
            action,
            created_at: now,
        });
        token
    }

    /// Consumes a token, returning `Ok(())` if it is valid, unexpired, and matches the requested scope.
    /// 
    /// **SECURITY NOTE (Burn-on-Read):**
    /// Tokens are immediately and permanently removed ("burned") upon the *first* attempt to consume them, 
    /// regardless of whether the scope validation succeeds or fails. 
    /// This fail-closed design guarantees single-use but means that if a downstream database operation fails 
    /// *after* token consumption, the user will need to restart the request→confirm flow to obtain a new token.
    pub fn consume(&self, token: &str, expected_action: &ActionType) -> Result<(), &'static str> {
        let mut map = self.tokens.lock().unwrap();
        
        // Remove the token immediately to guarantee single-use, whether valid or not.
        let entry = map.remove(token).ok_or("Invalid or expired token")?;
        
        // Check TTL expiry (5 minutes)
        if entry.created_at.elapsed() > Duration::from_secs(300) {
            return Err("Token expired");
        }

        // Enforce strict ActionType scoping
        if &entry.action != expected_action {
            return Err("Token scope mismatch (cross-action replay blocked)");
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn test_sweep_on_mint_eviction() {
        let store = SecureTokenStore::new();
        
        // 1. Manually insert a token that is 10 minutes old (expired)
        let expired_token_id = "expired-token-123".to_string();
        {
            let mut map = store.tokens.lock().unwrap();
            map.insert(expired_token_id.clone(), TokenEntry {
                action: ActionType::DeleteWorkspace { id: "ws1".to_string() },
                created_at: Instant::now() - Duration::from_secs(600), // 10 minutes ago
            });
        }
        
        // 2. Mint token B (fresh)
        let fresh_token_id = store.mint(ActionType::DeleteWorkspace { id: "ws2".to_string() });
        
        // 3. Assert expired token A is no longer in the map
        {
            let map = store.tokens.lock().unwrap();
            assert!(!map.contains_key(&expired_token_id), "Expired token must be swept upon minting new token");
            // 4. Assert token B is still valid
            assert!(map.contains_key(&fresh_token_id), "Fresh token must remain");
        }
    }

    #[test]
    fn test_burn_on_read_and_sweep_conflict() {
        let store = SecureTokenStore::new();
        
        // 1. Mint token A
        let token_a = store.mint(ActionType::DeleteWorkspace { id: "ws1".to_string() });
        
        // 2. Consume token A (burn-on-read removes it)
        let consume_res = store.consume(&token_a, &ActionType::DeleteWorkspace { id: "ws1".to_string() });
        assert!(consume_res.is_ok(), "First consumption should succeed");
        
        // 3. Mint token B immediately after — sweep runs, but A is already gone.
        let token_b = store.mint(ActionType::DeleteWorkspace { id: "ws2".to_string() });
        
        // 4. Assert this did not panic (we got token_b successfully)
        assert!(!token_b.is_empty(), "Minting should succeed even if sweep finds nothing to remove");
        
        // 5. Assert token A cannot be consumed a second time
        let second_consume = store.consume(&token_a, &ActionType::DeleteWorkspace { id: "ws1".to_string() });
        assert!(second_consume.is_err(), "Token A must still enforce single-use");
        assert_eq!(second_consume.unwrap_err(), "Invalid or expired token");
    }
}
