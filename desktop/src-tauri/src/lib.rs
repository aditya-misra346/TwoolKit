pub mod fs_ops;
pub mod security;
pub mod sync;

use crate::fs_ops::{
    perform_file_operation, scan_directory_recursive, NativeFileOpResult, NativeScannedEntry,
};
use crate::security::{AuthorizedGrantStore, EncryptedVault};
use crate::sync::{
    evaluate_sync_compatibility, fetch_remote_manifest, probe_endpoint_health, NetworkHealthStatus,
    WebsiteSyncEvaluation, DEFAULT_PRODUCTION_WEB_URL,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_updater::UpdaterExt;

pub struct DesktopAppState {
    pub grants: AuthorizedGrantStore,
    pub vault: EncryptedVault,
    pub remote_web_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopRuntimeInfo {
    pub is_desktop: bool,
    pub desktop_version: String,
    pub os: String,
    pub arch: String,
    pub remote_web_url: String,
    pub authorized_directories: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeUpdateCheckResult {
    pub update_available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub release_notes: Option<String>,
    pub installed: bool,
    pub message: String,
}

#[tauri::command]
fn get_desktop_runtime_info(state: State<'_, DesktopAppState>) -> DesktopRuntimeInfo {
    DesktopRuntimeInfo {
        is_desktop: true,
        desktop_version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        remote_web_url: state.remote_web_url.clone(),
        authorized_directories: state.grants.list_grants(),
    }
}

#[tauri::command]
async fn authorize_directory(
    state: State<'_, DesktopAppState>,
    explicit_path: Option<String>,
) -> Result<Option<String>, String> {
    let selected_path: Option<PathBuf> = if let Some(raw) = explicit_path {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(PathBuf::from(trimmed))
        }
    } else {
        rfd::FileDialog::new()
            .set_title("TwoolKit Desktop — Authorize Folder for Local Processing")
            .pick_folder()
    };

    let Some(folder) = selected_path else {
        return Ok(None);
    };

    let canonical = state.grants.grant_directory(&folder)?;
    Ok(Some(canonical.to_string_lossy().to_string()))
}

#[tauri::command]
fn list_authorized_directories(state: State<'_, DesktopAppState>) -> Vec<String> {
    state.grants.list_grants()
}

#[tauri::command]
fn revoke_authorized_directory(
    state: State<'_, DesktopAppState>,
    directory: String,
) -> Result<bool, String> {
    state.grants.revoke_directory(Path::new(&directory))
}

#[tauri::command]
async fn scan_authorized_directory(
    state: State<'_, DesktopAppState>,
    directory: String,
    max_files: Option<usize>,
) -> Result<Vec<NativeScannedEntry>, String> {
    let grants = state.grants.snapshot();
    let dir_path = PathBuf::from(directory);
    let limit = max_files.unwrap_or(10_000);
    tauri::async_runtime::spawn_blocking(move || {
        scan_directory_recursive(&dir_path, &grants, limit)
    })
    .await
    .map_err(|e| format!("Native scanner worker error: {}", e))?
}

#[tauri::command]
async fn save_output_file_dialog(
    default_name: String,
    bytes: Vec<u8>,
) -> Result<Option<String>, String> {
    let safe_name = Path::new(&default_name)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "twoolkit-output.bin".to_string());

    let destination = rfd::FileDialog::new()
        .set_title("Save Processed File — TwoolKit Desktop")
        .set_file_name(&safe_name)
        .save_file();

    let Some(path) = destination else {
        return Ok(None);
    };

    fs::write(&path, &bytes)
        .map_err(|e| format!("Failed to write output file '{}': {}", path.display(), e))?;
    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
fn native_file_operation(
    state: State<'_, DesktopAppState>,
    operation: String,
    source_path: String,
    target_path: Option<String>,
) -> Result<NativeFileOpResult, String> {
    let grants = state.grants.snapshot();
    let src = PathBuf::from(source_path);
    let dst = target_path.map(PathBuf::from);
    perform_file_operation(&operation, &src, dst.as_deref(), &grants)
}

#[tauri::command]
async fn check_website_sync(
    state: State<'_, DesktopAppState>,
    current_sha: String,
) -> Result<WebsiteSyncEvaluation, String> {
    let manifest = fetch_remote_manifest(&state.remote_web_url).await?;
    Ok(evaluate_sync_compatibility(
        &current_sha,
        &manifest.git_sha,
        &manifest.app_version,
        env!("CARGO_PKG_VERSION"),
        &manifest.min_desktop_version,
    ))
}

#[tauri::command]
async fn check_native_update(
    app: AppHandle,
    install_if_available: Option<bool>,
) -> Result<NativeUpdateCheckResult, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let updater = app
        .updater()
        .map_err(|e| format!("Native updater initialization error: {}", e))?;

    let update_opt = updater
        .check()
        .await
        .map_err(|e| format!("Failed to check native update feed: {}", e))?;

    let Some(update) = update_opt else {
        return Ok(NativeUpdateCheckResult {
            update_available: false,
            current_version,
            latest_version: None,
            release_notes: None,
            installed: false,
            message: "TwoolKit Desktop is up to date.".to_string(),
        });
    };

    let latest_version = Some(update.version.clone());
    let release_notes = update.body.clone();
    let should_install = install_if_available.unwrap_or(false);

    if should_install {
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|e| format!("Failed to download and verify signed update: {}", e))?;

        Ok(NativeUpdateCheckResult {
            update_available: true,
            current_version,
            latest_version,
            release_notes,
            installed: true,
            message:
                "Signed native update verified and installed. Restart TwoolKit Desktop to apply."
                    .to_string(),
        })
    } else {
        Ok(NativeUpdateCheckResult {
            update_available: true,
            current_version,
            latest_version,
            release_notes,
            installed: false,
            message: "A signed native desktop update is available.".to_string(),
        })
    }
}

#[tauri::command]
fn vault_set_secret(
    state: State<'_, DesktopAppState>,
    key: String,
    value: String,
) -> Result<bool, String> {
    state.vault.set_secret(&key, &value)?;
    Ok(true)
}

#[tauri::command]
fn vault_get_secret(
    state: State<'_, DesktopAppState>,
    key: String,
) -> Result<Option<String>, String> {
    state.vault.get_secret(&key)
}

#[tauri::command]
fn vault_delete_secret(state: State<'_, DesktopAppState>, key: String) -> Result<bool, String> {
    state.vault.delete_secret(&key)
}

#[tauri::command]
fn quit_application(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
async fn check_network_status(
    state: State<'_, DesktopAppState>,
) -> Result<NetworkHealthStatus, String> {
    Ok(probe_endpoint_health(&state.remote_web_url).await)
}

#[tauri::command]
async fn retry_workspace_connection(
    app: AppHandle,
    state: State<'_, DesktopAppState>,
) -> Result<bool, String> {
    let health = probe_endpoint_health(&state.remote_web_url).await;
    if health.frontend_reachable {
        if let Some(window) = app.get_webview_window("main") {
            if let Ok(target) = state.remote_web_url.parse() {
                let _ = window.navigate(target);
                return Ok(true);
            }
        }
    }
    Ok(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let remote_web_url = std::env::var("TWOOLKIT_WEB_URL")
        .unwrap_or_else(|_| DEFAULT_PRODUCTION_WEB_URL.to_string());

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(move |app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("com.adityamisra.twoolkit"));
            let _ = fs::create_dir_all(&app_data_dir);

            let grants_path = app_data_dir.join("authorized_grants.json");
            let vault_path = app_data_dir.join("vault.json");
            let machine_salt = format!(
                "{}:{}:{}",
                std::env::consts::OS,
                std::env::consts::ARCH,
                app_data_dir.to_string_lossy()
            );

            app.manage(DesktopAppState {
                grants: AuthorizedGrantStore::new(Some(grants_path)),
                vault: EncryptedVault::new(vault_path, &machine_salt),
                remote_web_url: remote_web_url.clone(),
            });

            // If an explicit developer override was set (e.g. TWOOLKIT_WEB_URL=http://localhost:3000), navigate to it
            if let Ok(custom_url) = std::env::var("TWOOLKIT_WEB_URL") {
                if let Ok(target) = custom_url.parse() {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.navigate(target);
                    }
                }
            } else {
                // Intelligent startup check: if the production website cannot be reached,
                // fall back gracefully to the local offline recovery screen
                let app_handle = app.handle().clone();
                let target_url = remote_web_url.clone();
                tauri::async_runtime::spawn(async move {
                    let health = probe_endpoint_health(&target_url).await;
                    if !health.frontend_reachable {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            if let Ok(fallback_url) = "tauri://localhost/index.html".parse() {
                                let _ = window.navigate(fallback_url);
                            }
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_desktop_runtime_info,
            authorize_directory,
            list_authorized_directories,
            revoke_authorized_directory,
            scan_authorized_directory,
            save_output_file_dialog,
            native_file_operation,
            check_website_sync,
            check_native_update,
            check_network_status,
            retry_workspace_connection,
            vault_set_secret,
            vault_get_secret,
            vault_delete_secret,
            quit_application,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TwoolKit Desktop application");
}
