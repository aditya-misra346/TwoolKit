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
}
