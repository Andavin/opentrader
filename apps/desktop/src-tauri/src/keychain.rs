use keyring::Entry;
use serde::Serialize;

const SERVICE: &str = "com.andavin.opentrader";

#[derive(Debug, Serialize, thiserror::Error)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum KeychainError {
    #[error("keychain entry not found")]
    NotFound,
    #[error("keychain backend error: {message}")]
    Backend { message: String },
}

impl From<keyring::Error> for KeychainError {
    fn from(value: keyring::Error) -> Self {
        match value {
            keyring::Error::NoEntry => KeychainError::NotFound,
            other => KeychainError::Backend { message: other.to_string() },
        }
    }
}

#[tauri::command]
pub fn keychain_get(key: String) -> Result<String, KeychainError> {
    let entry = Entry::new(SERVICE, &key)?;
    entry.get_password().map_err(KeychainError::from)
}

#[tauri::command]
pub fn keychain_set(key: String, value: String) -> Result<(), KeychainError> {
    let entry = Entry::new(SERVICE, &key)?;
    entry.set_password(&value).map_err(KeychainError::from)
}

#[tauri::command]
pub fn keychain_delete(key: String) -> Result<(), KeychainError> {
    let entry = Entry::new(SERVICE, &key)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(KeychainError::from(e)),
    }
}
