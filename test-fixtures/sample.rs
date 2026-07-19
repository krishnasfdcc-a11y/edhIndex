use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};
use sha2::{Sha256, Digest};
use serde::{Serialize, Deserialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UserRole {
    Admin,
    User,
    Viewer,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserConfig {
    pub name: String,
    pub email: String,
    pub role: UserRole,
    pub settings: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub status: u16,
    pub data: Option<T>,
    pub message: String,
    pub timestamp: u64,
}

#[derive(Error, Debug)]
pub enum ServiceError {
    #[error("not found")]
    NotFound,
    #[error("validation error: {0}")]
    Validation(String),
    #[error("internal error: {0}")]
    Internal(String),
}

pub trait BaseService {
    fn base_url(&self) -> &str;
    fn timeout_ms(&self) -> u64;

    fn log(&self, method: &str, path: &str) {
        println!("[{}] {} {}", method, self.base_url(), path);
    }
}

pub struct UserService {
    base_url: String,
    timeout: u64,
    users: Arc<RwLock<HashMap<String, UserConfig>>>,
}

impl UserService {
    pub fn new() -> Self {
        Self {
            base_url: "https://api.example.com/users".to_string(),
            timeout: 5000,
            users: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn get_user(&self, id: &str) -> Result<ApiResponse<UserConfig>, ServiceError> {
        let users = self.users.read().map_err(|e| ServiceError::Internal(e.to_string()))?;
        match users.get(id) {
            Some(user) => Ok(ApiResponse {
                status: 200, data: Some(user.clone()), message: "OK".to_string(),
                timestamp: now(),
            }),
            None => Ok(ApiResponse {
                status: 404, data: None, message: "Not found".to_string(),
                timestamp: now(),
            }),
        }
    }

    pub fn create_user(&self, config: UserConfig) -> Result<ApiResponse<UserConfig>, ServiceError> {
        validate_config(&config)?;
        let id = generate_id();
        let mut users = self.users.write().map_err(|e| ServiceError::Internal(e.to_string()))?;
        users.insert(id, config.clone());
        Ok(ApiResponse {
            status: 201, data: Some(config), message: "Created".to_string(),
            timestamp: now(),
        })
    }

    pub fn update_user(&self, id: &str, updates: HashMap<String, String>) -> Result<ApiResponse<UserConfig>, ServiceError> {
        let mut users = self.users.write().map_err(|e| ServiceError::Internal(e.to_string()))?;
        let user = users.get_mut(id).ok_or(ServiceError::NotFound)?;
        if let Some(name) = updates.get("name") {
            user.name = name.clone();
        }
        if let Some(email) = updates.get("email") {
            user.email = email.clone();
        }
        Ok(ApiResponse {
            status: 200, data: Some(user.clone()), message: "Updated".to_string(),
            timestamp: now(),
        })
    }

    pub fn delete_user(&self, id: &str) -> Result<ApiResponse<()>, ServiceError> {
        let mut users = self.users.write().map_err(|e| ServiceError::Internal(e.to_string()))?;
        users.remove(id).ok_or(ServiceError::NotFound)?;
        Ok(ApiResponse {
            status: 200, data: None, message: "Deleted".to_string(),
            timestamp: now(),
        })
    }

    pub fn list_users(&self) -> Result<Vec<UserConfig>, ServiceError> {
        let users = self.users.read().map_err(|e| ServiceError::Internal(e.to_string()))?;
        Ok(users.values().cloned().collect())
    }
}

impl BaseService for UserService {
    fn base_url(&self) -> &str { &self.base_url }
    fn timeout_ms(&self) -> u64 { self.timeout }
}

fn validate_config(config: &UserConfig) -> Result<(), ServiceError> {
    if config.name.is_empty() {
        return Err(ServiceError::Validation("name is required".to_string()));
    }
    if !config.email.contains('@') {
        return Err(ServiceError::Validation("invalid email".to_string()));
    }
    Ok(())
}

fn generate_id() -> String {
    use rand::Rng;
    let id: String = (0..32).map(|_| format!("{:x}", rand::thread_rng().gen_range(0..16))).collect();
    id
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs()
}

pub fn calculate_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn validate_email(email: &str) -> bool {
    email.contains('@') && email.contains('.')
}

pub fn paginate<T: Clone>(items: &[T], page: usize, per_page: usize) -> PaginatedResult<T> {
    let start = (page.saturating_sub(1)) * per_page;
    let end = std::cmp::min(start + per_page, items.len());
    let pages = if items.is_empty() { 0 } else { (items.len() + per_page - 1) / per_page };
    PaginatedResult {
        items: items[start..end].to_vec(),
        total: items.len(),
        pages,
    }
}

pub struct PaginatedResult<T> {
    pub items: Vec<T>,
    pub total: usize,
    pub pages: usize,
}

pub fn read_config(path: &Path) -> Result<UserConfig, ServiceError> {
    let data = fs::read_to_string(path).map_err(|e| ServiceError::Internal(e.to_string()))?;
    serde_json::from_str(&data).map_err(|e| ServiceError::Internal(e.to_string()))
}

pub fn write_config(path: &Path, config: &UserConfig) -> Result<(), ServiceError> {
    let data = serde_json::to_string_pretty(config).map_err(|e| ServiceError::Internal(e.to_string()))?;
    fs::write(path, data).map_err(|e| ServiceError::Internal(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_email() {
        assert!(validate_email("test@example.com"));
        assert!(!validate_email("invalid"));
    }
}
