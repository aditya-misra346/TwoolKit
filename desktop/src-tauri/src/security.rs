use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

const BLOCKED_UNIX_PREFIXES: &[&str] = &[
    "/System",
    "/Library/SystemExtensions",
    "/etc",
    "/private/etc",
    "/usr",
    "/bin",
    "/sbin",
    "/var/root",
    "/dev",
    "/proc",
    "/sys",
    "/boot",
];

const BLOCKED_WINDOWS_PREFIXES: &[&str] = &[
    "c:\\windows",
    "c:\\program files",
    "c:\\program files (x86)",
    "c:\\programdata",
    "c:\\system volume information",
];

const BLOCKED_DOT_DIRS: &[&str] = &[
    ".ssh",
    ".aws",
    ".gnupg",
    ".kube",
    ".docker",
    ".config/gcloud",
    ".azure",
    ".npmrc",
    ".pypirc",
    ".netrc",
];

/// Checks whether a given path points to a sensitive system directory or credential store.
pub fn is_blocked_system_path(path: &Path) -> bool {
    let raw = path.to_string_lossy();
    let normalized_lower = raw.replace('\\', "/").to_lowercase();

    for comp in path.components() {
        if matches!(comp, Component::ParentDir) {
            return true;
        }
        if let Component::Normal(os_str) = comp {
            let part = os_str.to_string_lossy().to_lowercase();
            for dot in BLOCKED_DOT_DIRS {
                if part == *dot {
                    return true;
                }
            }
        }
    }

    for blocked in BLOCKED_DOT_DIRS {
        let needle = format!("/{}", blocked);
        if normalized_lower.ends_with(&needle) || normalized_lower.contains(&format!("{}/", needle))
        {
            return true;
        }
    }

    // Block root directory itself (`/` or `C:\`)
    if normalized_lower == "/"
        || normalized_lower == "c:/"
        || normalized_lower == "c:"
        || normalized_lower.is_empty()
    {
        return true;
    }

    for prefix in BLOCKED_UNIX_PREFIXES {
        let p_lower = prefix.to_lowercase();
        if normalized_lower == p_lower || normalized_lower.starts_with(&format!("{}/", p_lower)) {
            return true;
        }
    }

    let win_lower = raw.to_lowercase();
    for prefix in BLOCKED_WINDOWS_PREFIXES {
        if win_lower == *prefix || win_lower.starts_with(&format!("{}\\", prefix)) {
            return true;
        }
    }

    false
}

/// Validates that a target path (existing or to-be-created inside an existing parent)
/// is strictly inside one of the user-authorized grant directories and not blocked.
pub fn validate_scoped_path(
    target: &Path,
    grants: &HashSet<PathBuf>,
    require_exists: bool,
) -> Result<PathBuf, String> {
    for comp in target.components() {
        if matches!(comp, Component::ParentDir) {
            return Err("Path traversal ('..') is strictly prohibited.".to_string());
        }
    }

    if is_blocked_system_path(target) {
        return Err(format!(
            "Access denied: '{}' is a protected operating system or credential path.",
            target.display()
        ));
    }

    let resolved = if target.exists() {
        fs::canonicalize(target)
            .map_err(|e| format!("Failed to resolve path '{}': {}", target.display(), e))?
    } else if require_exists {
        return Err(format!("Path does not exist: '{}'", target.display()));
    } else {
        let parent = target
            .parent()
            .ok_or_else(|| format!("Path '{}' has no valid parent directory.", target.display()))?;
        let file_name = target
            .file_name()
            .ok_or_else(|| format!("Path '{}' has no valid file name.", target.display()))?;
        let canonical_parent = fs::canonicalize(parent).map_err(|e| {
            format!(
                "Failed to resolve parent directory '{}': {}",
                parent.display(),
                e
            )
        })?;
        canonical_parent.join(file_name)
    };

    if is_blocked_system_path(&resolved) {
        return Err(format!(
            "Access denied: resolved path '{}' points to a protected system location.",
            resolved.display()
        ));
    }

    let is_within_grant = grants.iter().any(|grant| resolved.starts_with(grant));
    if !is_within_grant {
        return Err(format!(
            "Scoped security violation: '{}' is outside authorized folders. Please grant access via the folder picker first.",
            resolved.display()
        ));
    }

    Ok(resolved)
}

#[derive(Debug, Default)]
pub struct AuthorizedGrantStore {
    grants: Mutex<HashSet<PathBuf>>,
    persistence_path: Option<PathBuf>,
}

impl AuthorizedGrantStore {
    pub fn new(persistence_path: Option<PathBuf>) -> Self {
        let mut initial = HashSet::new();
        if let Some(ref path) = persistence_path {
            if let Ok(raw) = fs::read_to_string(path) {
                if let Ok(saved) = serde_json::from_str::<Vec<String>>(&raw) {
                    for item in saved {
                        let pb = PathBuf::from(item);
                        if pb.exists() && !is_blocked_system_path(&pb) {
                            if let Ok(canon) = fs::canonicalize(&pb) {
                                if !is_blocked_system_path(&canon) {
                                    initial.insert(canon);
                                }
                            }
                        }
                    }
                }
            }
        }
        Self {
            grants: Mutex::new(initial),
            persistence_path,
        }
    }

    pub fn grant_directory(&self, dir: &Path) -> Result<PathBuf, String> {
        if is_blocked_system_path(dir) {
            return Err(format!(
                "Cannot authorize protected system directory '{}'.",
                dir.display()
            ));
        }
        let canonical = fs::canonicalize(dir)
            .map_err(|e| format!("Directory '{}' cannot be resolved: {}", dir.display(), e))?;
        if !canonical.is_dir() {
            return Err(format!("'{}' is not a directory.", canonical.display()));
        }
        if is_blocked_system_path(&canonical) {
            return Err(format!(
                "Cannot authorize protected system directory '{}'.",
                canonical.display()
            ));
        }

        let mut guard = self
            .grants
            .lock()
            .map_err(|_| "Failed to acquire grant store lock.".to_string())?;
        guard.insert(canonical.clone());
        self.persist_locked(&guard);
        Ok(canonical)
    }

    pub fn revoke_directory(&self, dir: &Path) -> Result<bool, String> {
        let canonical = fs::canonicalize(dir).unwrap_or_else(|_| dir.to_path_buf());
        let mut guard = self
            .grants
            .lock()
            .map_err(|_| "Failed to acquire grant store lock.".to_string())?;
        let removed = guard.remove(&canonical) || guard.remove(dir);
        self.persist_locked(&guard);
        Ok(removed)
    }

    pub fn list_grants(&self) -> Vec<String> {
        let guard = match self.grants.lock() {
            Ok(g) => g,
            Err(_) => return Vec::new(),
        };
        let mut list: Vec<String> = guard
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect();
        list.sort();
        list
    }

    pub fn snapshot(&self) -> HashSet<PathBuf> {
        self.grants.lock().map(|g| g.clone()).unwrap_or_default()
    }

    fn persist_locked(&self, set: &HashSet<PathBuf>) {
        if let Some(ref path) = self.persistence_path {
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let list: Vec<String> = set
                .iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            if let Ok(json) = serde_json::to_string_pretty(&list) {
                let _ = fs::write(path, json);
            }
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct VaultFileFormat {
    version: u32,
    entries: BTreeMap<String, String>,
}

/// Local encrypted credential vault with SHA-256 stream cipher and strict 0600 permissions on Unix.
pub struct EncryptedVault {
    vault_path: PathBuf,
    master_secret: Vec<u8>,
    lock: Mutex<()>,
}

impl EncryptedVault {
    pub fn new(vault_path: PathBuf, machine_salt: &str) -> Self {
        let mut hasher = Sha256::new();
        hasher.update(b"TwoolKit-Desktop-Vault-v1:");
        hasher.update(machine_salt.as_bytes());
        let master_secret = hasher.finalize().to_vec();

        Self {
            vault_path,
            master_secret,
            lock: Mutex::new(()),
        }
    }

    fn xor_transform(&self, key_name: &str, input: &[u8]) -> Vec<u8> {
        let mut output = Vec::with_capacity(input.len());
        let mut counter: u64 = 0;

        while output.len() < input.len() {
            let mut hasher = Sha256::new();
            hasher.update(&self.master_secret);
            hasher.update(key_name.as_bytes());
            hasher.update(counter.to_le_bytes());
            let block = hasher.finalize();

            for byte in block.iter() {
                if output.len() >= input.len() {
                    break;
                }
                let idx = output.len();
                output.push(input[idx] ^ byte);
            }
            counter += 1;
        }
        output
    }

    pub fn set_secret(&self, key: &str, value: &str) -> Result<(), String> {
        if key.trim().is_empty() {
            return Err("Vault key cannot be empty.".to_string());
        }
        let _guard = self
            .lock
            .lock()
            .map_err(|_| "Vault lock poisoned".to_string())?;
        let mut data = self.load_unlocked();
        let cipher = self.xor_transform(key, value.as_bytes());
        let hex_encoded: String = cipher.iter().map(|b| format!("{:02x}", b)).collect();
        data.version = 1;
        data.entries.insert(key.to_string(), hex_encoded);
        self.save_unlocked(&data)
    }

    pub fn get_secret(&self, key: &str) -> Result<Option<String>, String> {
        let _guard = self
            .lock
            .lock()
            .map_err(|_| "Vault lock poisoned".to_string())?;
        let data = self.load_unlocked();
        let Some(hex_str) = data.entries.get(key) else {
            return Ok(None);
        };
        let bytes = Self::decode_hex(hex_str)?;
        let plain = self.xor_transform(key, &bytes);
        String::from_utf8(plain)
            .map(Some)
            .map_err(|e| format!("Failed to decode UTF-8 secret: {}", e))
    }

    pub fn delete_secret(&self, key: &str) -> Result<bool, String> {
        let _guard = self
            .lock
            .lock()
            .map_err(|_| "Vault lock poisoned".to_string())?;
        let mut data = self.load_unlocked();
        let existed = data.entries.remove(key).is_some();
        self.save_unlocked(&data)?;
        Ok(existed)
    }

    fn decode_hex(hex: &str) -> Result<Vec<u8>, String> {
        if !hex.len().is_multiple_of(2) {
            return Err("Corrupted hex entry in vault.".to_string());
        }
        let mut out = Vec::with_capacity(hex.len() / 2);
        for i in (0..hex.len()).step_by(2) {
            let byte = u8::from_str_radix(&hex[i..i + 2], 16)
                .map_err(|e| format!("Invalid hex byte: {}", e))?;
            out.push(byte);
        }
        Ok(out)
    }

    fn load_unlocked(&self) -> VaultFileFormat {
        if let Ok(raw) = fs::read_to_string(&self.vault_path) {
            if let Ok(parsed) = serde_json::from_str::<VaultFileFormat>(&raw) {
                return parsed;
            }
        }
        VaultFileFormat {
            version: 1,
            entries: BTreeMap::new(),
        }
    }

    fn save_unlocked(&self, data: &VaultFileFormat) -> Result<(), String> {
        if let Some(parent) = self.vault_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create vault directory: {}", e))?;
        }
        let serialized = serde_json::to_string_pretty(data)
            .map_err(|e| format!("Failed to serialize vault: {}", e))?;
        fs::write(&self.vault_path, serialized)
            .map_err(|e| format!("Failed to write vault file: {}", e))?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let perms = fs::Permissions::from_mode(0o600);
            let _ = fs::set_permissions(&self.vault_path, perms);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_blocks_system_and_credential_paths() {
        assert!(is_blocked_system_path(Path::new("/")));
        assert!(is_blocked_system_path(Path::new("/System/Library")));
        assert!(is_blocked_system_path(Path::new("/etc/passwd")));
        assert!(is_blocked_system_path(Path::new(
            "/Users/alice/.ssh/id_rsa"
        )));
        assert!(is_blocked_system_path(Path::new(
            "/Users/alice/.aws/credentials"
        )));
        assert!(is_blocked_system_path(Path::new("C:\\Windows\\System32")));
        assert!(is_blocked_system_path(Path::new("../outside")));
    }

    #[test]
    fn test_scoped_grant_allowlist_and_revocation() {
        let dir = tempdir().expect("create temp dir");
        let sub_file = dir.path().join("document.pdf");
        fs::write(&sub_file, b"%PDF-1.7 test content").expect("write test file");

        let store = AuthorizedGrantStore::new(None);

        // Before granting, validation must fail
        let pre_check = validate_scoped_path(&sub_file, &store.snapshot(), true);
        assert!(pre_check.is_err());

        // Grant directory
        let granted = store
            .grant_directory(dir.path())
            .expect("should grant temp dir");
        assert!(store
            .list_grants()
            .contains(&granted.to_string_lossy().to_string()));

        // After granting, validation succeeds
        let post_check = validate_scoped_path(&sub_file, &store.snapshot(), true);
        assert!(post_check.is_ok());

        // Traversal attempt inside granted directory must fail
        let traversal = dir.path().join("..").join("outside.txt");
        assert!(validate_scoped_path(&traversal, &store.snapshot(), false).is_err());

        // Revoke directory
        let revoked = store.revoke_directory(dir.path()).expect("revoke");
        assert!(revoked);
        assert!(validate_scoped_path(&sub_file, &store.snapshot(), true).is_err());
    }

    #[test]
    fn test_encrypted_vault_roundtrip() {
        let dir = tempdir().expect("tempdir");
        let vault_file = dir.path().join("vault.json");
        let vault = EncryptedVault::new(vault_file.clone(), "unit-test-salt-2026");

        vault
            .set_secret("cloud_api_token", "tk_live_987654321_secret")
            .expect("save secret");

        // Ensure plaintext is not stored on disk
        let raw_disk = fs::read_to_string(&vault_file).expect("read vault file");
        assert!(!raw_disk.contains("tk_live_987654321_secret"));

        // Ensure roundtrip decryption works
        let loaded = vault
            .get_secret("cloud_api_token")
            .expect("get secret")
            .expect("secret exists");
        assert_eq!(loaded, "tk_live_987654321_secret");

        // Delete secret
        assert!(vault.delete_secret("cloud_api_token").expect("delete"));
        assert_eq!(
            vault
                .get_secret("cloud_api_token")
                .expect("get after delete"),
            None
        );
    }
}
