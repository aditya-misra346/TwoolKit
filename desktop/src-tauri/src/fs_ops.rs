use crate::security::validate_scoped_path;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

const HEAD_BYTES_LIMIT: usize = 4096;
const HASH_FILE_SIZE_LIMIT: u64 = 256 * 1024 * 1024; // 256 MB cap for automatic SHA-256

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeScannedEntry {
    pub path: String,
    pub name: String,
    pub extension: String,
    pub size: u64,
    pub last_modified_ms: u64,
    pub sha256: Option<String>,
    pub head_bytes: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeFileOpResult {
    pub ok: bool,
    pub operation: String,
    pub source_path: String,
    pub target_path: Option<String>,
    pub message: String,
}

fn should_skip_dir(name: &str) -> bool {
    matches!(
        name,
        ".git"
            | "node_modules"
            | ".next"
            | "target"
            | "__pycache__"
            | ".venv"
            | ".DS_Store"
            | ".Trash"
    )
}

/// Recursively scans an authorized directory, computing SHA-256 content hashes and extracting
/// the first 4 KB header bytes for magic-byte file signature inspection.
pub fn scan_directory_recursive(
    root: &Path,
    grants: &HashSet<PathBuf>,
    max_files: usize,
) -> Result<Vec<NativeScannedEntry>, String> {
    let canonical_root = validate_scoped_path(root, grants, true)?;
    if !canonical_root.is_dir() {
        return Err(format!(
            "'{}' is not a directory.",
            canonical_root.display()
        ));
    }

    let limit = if max_files == 0 { 10_000 } else { max_files };
    let mut results = Vec::new();

    let walker = WalkDir::new(&canonical_root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| {
            if entry.depth() == 0 {
                return true;
            }
            if entry.file_type().is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    return !should_skip_dir(name);
                }
            }
            true
        });

    for entry in walker.flatten() {
        if results.len() >= limit {
            break;
        }
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        if validate_scoped_path(path, grants, true).is_err() {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let size = metadata.len();
        let last_modified_ms = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let extension = path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        let (head_bytes, sha256) = inspect_file_contents(path, size);

        results.push(NativeScannedEntry {
            path: path.to_string_lossy().to_string(),
            name,
            extension,
            size,
            last_modified_ms,
            sha256,
            head_bytes,
        });
    }

    Ok(results)
}

fn inspect_file_contents(path: &Path, size: u64) -> (Vec<u8>, Option<String>) {
    let mut file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return (Vec::new(), None),
    };

    let mut head = vec![0u8; HEAD_BYTES_LIMIT.min(size as usize)];
    let bytes_read = file.read(&mut head).unwrap_or(0);
    head.truncate(bytes_read);

    if size == 0 || size > HASH_FILE_SIZE_LIMIT {
        return (head, None);
    }

    let mut hasher = Sha256::new();
    hasher.update(&head);

    let mut buffer = [0u8; 64 * 1024];
    loop {
        match file.read(&mut buffer) {
            Ok(0) => break,
            Ok(n) => hasher.update(&buffer[..n]),
            Err(_) => return (head, None),
        }
    }

    let digest = hasher.finalize();
    let hex_hash: String = digest.iter().map(|b| format!("{:02x}", b)).collect();
    (head, Some(hex_hash))
}

/// Executes a scoped filesystem mutation (`rename`, `copy`, `move`, `delete`, `mkdir`)
/// strictly within user-authorized directories.
pub fn perform_file_operation(
    operation: &str,
    source_path: &Path,
    target_path: Option<&Path>,
    grants: &HashSet<PathBuf>,
) -> Result<NativeFileOpResult, String> {
    let op = operation.trim().to_lowercase();

    match op.as_str() {
        "mkdir" => {
            let validated = validate_scoped_path(source_path, grants, false)?;
            fs::create_dir_all(&validated).map_err(|e| {
                format!(
                    "Failed to create directory '{}': {}",
                    validated.display(),
                    e
                )
            })?;
            Ok(NativeFileOpResult {
                ok: true,
                operation: op,
                source_path: validated.to_string_lossy().to_string(),
                target_path: None,
                message: "Directory created.".to_string(),
            })
        }
        "delete" => {
            let validated_src = validate_scoped_path(source_path, grants, true)?;
            if grants.contains(&validated_src) {
                return Err("Refusing to delete root of an authorized grant folder.".to_string());
            }
            if validated_src.is_dir() {
                fs::remove_dir_all(&validated_src).map_err(|e| {
                    format!(
                        "Failed to delete folder '{}': {}",
                        validated_src.display(),
                        e
                    )
                })?;
            } else {
                fs::remove_file(&validated_src).map_err(|e| {
                    format!("Failed to delete file '{}': {}", validated_src.display(), e)
                })?;
            }
            Ok(NativeFileOpResult {
                ok: true,
                operation: op,
                source_path: validated_src.to_string_lossy().to_string(),
                target_path: None,
                message: "Deleted successfully.".to_string(),
            })
        }
        "rename" | "move" => {
            let dst = target_path
                .ok_or_else(|| "Target path is required for rename/move.".to_string())?;
            let validated_src = validate_scoped_path(source_path, grants, true)?;
            let validated_dst = validate_scoped_path(dst, grants, false)?;
            if let Some(parent) = validated_dst.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to prepare target directory: {}", e))?;
            }
            fs::rename(&validated_src, &validated_dst)
                .map_err(|e| format!("Failed to {} file: {}", op, e))?;
            Ok(NativeFileOpResult {
                ok: true,
                operation: op,
                source_path: validated_src.to_string_lossy().to_string(),
                target_path: Some(validated_dst.to_string_lossy().to_string()),
                message: "Moved/renamed successfully.".to_string(),
            })
        }
        "copy" => {
            let dst = target_path.ok_or_else(|| "Target path is required for copy.".to_string())?;
            let validated_src = validate_scoped_path(source_path, grants, true)?;
            let validated_dst = validate_scoped_path(dst, grants, false)?;
            if !validated_src.is_file() {
                return Err("Only regular files can be copied with 'copy'.".to_string());
            }
            if let Some(parent) = validated_dst.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to prepare target directory: {}", e))?;
            }
            fs::copy(&validated_src, &validated_dst)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
            Ok(NativeFileOpResult {
                ok: true,
                operation: op,
                source_path: validated_src.to_string_lossy().to_string(),
                target_path: Some(validated_dst.to_string_lossy().to_string()),
                message: "Copied successfully.".to_string(),
            })
        }
        _ => Err(format!("Unsupported file operation '{}'.", operation)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::security::AuthorizedGrantStore;
    use tempfile::tempdir;

    #[test]
    fn test_recursive_scan_and_sha256_magic_bytes() {
        let dir = tempdir().expect("tempdir");
        let pdf_path = dir.path().join("sample.pdf");
        let content = b"%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n";
        fs::write(&pdf_path, content).expect("write pdf");

        let dup_path = dir.path().join("duplicate.pdf");
        fs::write(&dup_path, content).expect("write duplicate pdf");

        let store = AuthorizedGrantStore::new(None);
        store
            .grant_directory(dir.path())
            .expect("grant temp directory");

        let scanned =
            scan_directory_recursive(dir.path(), &store.snapshot(), 500).expect("scan succeeds");
        assert_eq!(scanned.len(), 2);

        let first = &scanned[0];
        let second = &scanned[1];
        assert_eq!(first.sha256, second.sha256);
        assert!(first.sha256.is_some());
        assert!(first.head_bytes.starts_with(b"%PDF-1.7"));
    }

    #[test]
    fn test_scoped_file_operations_and_unauthorized_rejection() {
        let allowed_dir = tempdir().expect("allowed tempdir");
        let outside_dir = tempdir().expect("outside tempdir");

        let store = AuthorizedGrantStore::new(None);
        store
            .grant_directory(allowed_dir.path())
            .expect("grant allowed");

        // 1. mkdir inside allowed
        let sub_dir = allowed_dir.path().join("organized");
        let mkdir_res =
            perform_file_operation("mkdir", &sub_dir, None, &store.snapshot()).expect("mkdir");
        assert!(mkdir_res.ok);
        assert!(sub_dir.exists());

        // 2. Write file & copy inside allowed
        let src_file = allowed_dir.path().join("report.txt");
        fs::write(&src_file, b"TwoolKit Desktop Test").expect("write src");
        let copied_file = sub_dir.join("report_copy.txt");
        let copy_res =
            perform_file_operation("copy", &src_file, Some(&copied_file), &store.snapshot())
                .expect("copy");
        assert!(copy_res.ok);
        assert!(copied_file.exists());

        // 3. Reject copy to outside unauthorized folder
        let illegal_dst = outside_dir.path().join("exfiltrated.txt");
        let illegal_res =
            perform_file_operation("copy", &src_file, Some(&illegal_dst), &store.snapshot());
        assert!(illegal_res.is_err());

        // 4. Rename inside allowed
        let renamed_file = sub_dir.join("report_final.txt");
        let rename_res = perform_file_operation(
            "rename",
            &copied_file,
            Some(&renamed_file),
            &store.snapshot(),
        )
        .expect("rename");
        assert!(rename_res.ok);
        assert!(renamed_file.exists());

        // 5. Delete inside allowed
        let del_res =
            perform_file_operation("delete", &renamed_file, None, &store.snapshot()).expect("del");
        assert!(del_res.ok);
        assert!(!renamed_file.exists());
    }
}
