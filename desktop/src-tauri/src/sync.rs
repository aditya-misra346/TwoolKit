use serde::{Deserialize, Serialize};
use std::cmp::Ordering;

pub const DEFAULT_PRODUCTION_WEB_URL: &str = "https://twoolkit.vercel.app";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteDesktopManifest {
    pub app_version: String,
    pub git_sha: String,
    pub build_timestamp: String,
    pub min_desktop_version: String,
    pub website_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebsiteSyncEvaluation {
    pub current_sha: String,
    pub remote_sha: String,
    pub remote_app_version: String,
    pub native_desktop_version: String,
    pub min_desktop_version: String,
    pub has_website_update: bool,
    pub requires_native_upgrade: bool,
    pub can_hot_reload_safely: bool,
}

/// Compares two semantic version strings (e.g., `"1.2.0"` vs `"1.0.5"`).
pub fn compare_semver(a: &str, b: &str) -> Ordering {
    let parse = |v: &str| -> Vec<u64> {
        v.trim()
            .trim_start_matches(['v', 'V'])
            .split(['-', '+'])
            .next()
            .unwrap_or("")
            .split('.')
            .map(|part| part.parse::<u64>().unwrap_or(0))
            .collect()
    };

    let va = parse(a);
    let vb = parse(b);
    let max_len = va.len().max(vb.len()).max(3);

    for i in 0..max_len {
        let na = *va.get(i).unwrap_or(&0);
        let nb = *vb.get(i).unwrap_or(&0);
        match na.cmp(&nb) {
            Ordering::Equal => continue,
            non_eq => return non_eq,
        }
    }
    Ordering::Equal
}

/// Evaluates whether a newly deployed website build (`remote_sha`) is compatible
/// with the running native shell (`native_desktop_version` >= `min_desktop_version`)
/// and whether a hot-reload or native shell upgrade is required.
pub fn evaluate_sync_compatibility(
    current_sha: &str,
    remote_sha: &str,
    remote_app_version: &str,
    native_desktop_version: &str,
    min_desktop_version: &str,
) -> WebsiteSyncEvaluation {
    let cur = current_sha.trim();
    let rem = remote_sha.trim();
    let has_website_update = !cur.is_empty() && !rem.is_empty() && cur != rem;
    let requires_native_upgrade =
        compare_semver(native_desktop_version, min_desktop_version) == Ordering::Less;
    let can_hot_reload_safely = has_website_update && !requires_native_upgrade;

    WebsiteSyncEvaluation {
        current_sha: cur.to_string(),
        remote_sha: rem.to_string(),
        remote_app_version: remote_app_version.to_string(),
        native_desktop_version: native_desktop_version.to_string(),
        min_desktop_version: min_desktop_version.to_string(),
        has_website_update,
        requires_native_upgrade,
        can_hot_reload_safely,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkHealthStatus {
    pub is_online: bool,
    pub frontend_reachable: bool,
    pub backend_reachable: bool,
    pub production_url: String,
    pub status_message: String,
}

/// Probes whether a given TwoolKit endpoint is reachable, distinguishing between
/// offline internet, unreachable frontend, and backend processing state.
pub async fn probe_endpoint_health(base_url: &str) -> NetworkHealthStatus {
    let trimmed = base_url.trim_end_matches('/');
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(2500))
        .user_agent(format!(
            "TwoolKit-Desktop/{} ({})",
            env!("CARGO_PKG_VERSION"),
            std::env::consts::OS
        ))
        .build()
    {
        Ok(c) => c,
        Err(_) => {
            return NetworkHealthStatus {
                is_online: false,
                frontend_reachable: false,
                backend_reachable: false,
                production_url: base_url.to_string(),
                status_message: "Failed to initialize HTTP client.".to_string(),
            }
        }
    };

    // 1. Probe frontend health endpoint
    let health_url = format!("{}/api/health", trimmed);
    if let Ok(res) = client.get(&health_url).send().await {
        if res.status().is_success() {
            return NetworkHealthStatus {
                is_online: true,
                frontend_reachable: true,
                backend_reachable: true,
                production_url: base_url.to_string(),
                status_message: "Operational".to_string(),
            };
        }
    }

    // 2. If /api/health returned non-200, probe root landing page
    if let Ok(res) = client.get(trimmed).send().await {
        if res.status().is_success() {
            return NetworkHealthStatus {
                is_online: true,
                frontend_reachable: true,
                backend_reachable: false,
                production_url: base_url.to_string(),
                status_message: "Frontend online; processing verification pending.".to_string(),
            };
        }
    }

    // 3. Check general internet connectivity to distinguish offline from server downtime
    let is_online = client
        .get("https://1.1.1.1")
        .timeout(std::time::Duration::from_millis(1500))
        .send()
        .await
        .is_ok();

    let status_message = if is_online {
        format!(
            "Internet connection active, but {} is unreachable.",
            base_url
        )
    } else {
        "No internet connection detected. Please verify your Wi-Fi or network connection."
            .to_string()
    };

    NetworkHealthStatus {
        is_online,
        frontend_reachable: false,
        backend_reachable: false,
        production_url: base_url.to_string(),
        status_message,
    }
}

/// Fetches `/api/desktop-manifest` from the configured TwoolKit production URL.
pub async fn fetch_remote_manifest(base_url: &str) -> Result<RemoteDesktopManifest, String> {
    let trimmed = base_url.trim_end_matches('/');
    let endpoint = format!("{}/api/desktop-manifest", trimmed);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .user_agent(format!(
            "TwoolKit-Desktop/{} ({})",
            env!("CARGO_PKG_VERSION"),
            std::env::consts::OS
        ))
        .build()
        .map_err(|e| format!("Failed to construct HTTP client: {}", e))?;

    let response = client
        .get(&endpoint)
        .header("Cache-Control", "no-cache")
        .send()
        .await
        .map_err(|e| format!("Failed to reach {}: {}", endpoint, e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Manifest endpoint {} returned HTTP {}",
            endpoint,
            response.status()
        ));
    }

    response
        .json::<RemoteDesktopManifest>()
        .await
        .map_err(|e| format!("Invalid manifest JSON from {}: {}", endpoint, e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_semver_comparison_and_downgrade_detection() {
        assert_eq!(compare_semver("1.2.0", "1.2.0"), Ordering::Equal);
        assert_eq!(compare_semver("1.2.1", "1.2.0"), Ordering::Greater);
        assert_eq!(compare_semver("2.0.0", "1.9.9"), Ordering::Greater);
        assert_eq!(compare_semver("1.0.0", "1.2.0"), Ordering::Less);
        assert_eq!(compare_semver("v1.2.0", "1.2"), Ordering::Equal);
    }

    #[test]
    fn test_website_sync_two_version_upgrade_workflow() {
        // Simulated v1 -> v2 website deployment while desktop shell is at 1.2.0
        let eval = evaluate_sync_compatibility("e708bad", "9f41c2a", "1.2.1", "1.2.0", "1.0.0");
        assert!(eval.has_website_update);
        assert!(!eval.requires_native_upgrade);
        assert!(eval.can_hot_reload_safely);

        // Simulated breaking Rust bridge change where website requires desktop >= 2.0.0
        let breaking_eval =
            evaluate_sync_compatibility("e708bad", "a1b2c3d", "2.0.0", "1.2.0", "2.0.0");
        assert!(breaking_eval.has_website_update);
        assert!(breaking_eval.requires_native_upgrade);
        assert!(!breaking_eval.can_hot_reload_safely);
    }

    #[test]
    fn test_probe_endpoint_offline_resilience() {
        tauri::async_runtime::block_on(async {
            let health = probe_endpoint_health("http://127.0.0.1:49999").await;
            assert!(!health.frontend_reachable);
            assert!(!health.backend_reachable);
        });
    }
}
