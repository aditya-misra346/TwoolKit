#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# TwoolKit Desktop — macOS Code Signing, Hardened Runtime & Apple Notarization
# ==============================================================================
# Usage:
#   ./desktop/scripts/macos_sign_and_notarize.sh <ARCH_TARGET>
# Example:
#   ./desktop/scripts/macos_sign_and_notarize.sh aarch64-apple-darwin
#   ./desktop/scripts/macos_sign_and_notarize.sh x86_64-apple-darwin
#
# Supported Environment Variables (for Apple Developer ID & Notarization):
#   APPLE_SIGNING_IDENTITY : e.g. "Developer ID Application: Aditya Misra (TEAMID)"
#                            (Defaults to "-" structural bundle seal if not set)
#   APPLE_ID               : Apple Developer account email (for notarytool)
#   APPLE_PASSWORD         : App-specific password for APPLE_ID
#   APPLE_TEAM_ID          : 10-character Apple Developer Team ID
#   APPLE_API_KEY          : App Store Connect API Key ID (alternative to APPLE_ID)
#   APPLE_API_ISSUER       : App Store Connect API Issuer UUID
#   APPLE_API_KEY_PATH     : Path to AuthKey_<KEY_ID>.p8
# ==============================================================================

TARGET="${1:-aarch64-apple-darwin}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TAURI_DIR="${DESKTOP_DIR}/src-tauri"
ENTITLEMENTS="${TAURI_DIR}/Entitlements.plist"
BUNDLE_DIR="${TAURI_DIR}/target/${TARGET}/release/bundle"
APP_BUNDLE="${BUNDLE_DIR}/macos/TwoolKit.app"

if [[ "${TARGET}" == "aarch64-apple-darwin" ]]; then
  DMG_FILE="${BUNDLE_DIR}/dmg/TwoolKit_1.2.0_aarch64.dmg"
else
  DMG_FILE="${BUNDLE_DIR}/dmg/TwoolKit_1.2.0_x64.dmg"
fi

IDENTITY="${APPLE_SIGNING_IDENTITY:--}"

echo "=== [1/6] Verifying TwoolKit.app bundle structure (${TARGET}) ==="
if [[ ! -d "${APP_BUNDLE}" ]]; then
  echo "ERROR: Application bundle not found at ${APP_BUNDLE}" >&2
  exit 1
fi

SIGN_TIMESTAMP_FLAG="--timestamp"
if [[ "${IDENTITY}" == "-" ]]; then
  SIGN_TIMESTAMP_FLAG="--timestamp=none"
  echo "INFO: No Developer ID certificate provided in APPLE_SIGNING_IDENTITY; using '-' with Hardened Runtime & sealed _CodeSignature/CodeResources."
else
  echo "INFO: Signing with Apple Developer ID identity: ${IDENTITY}"
fi

echo "=== [2/6] Signing nested executables, dylibs, and frameworks inside TwoolKit.app ==="
if [[ -d "${APP_BUNDLE}/Contents/Frameworks" ]]; then
  find "${APP_BUNDLE}/Contents/Frameworks" -type f \( -name "*.dylib" -o -perm +111 \) -print0 | while IFS= read -r -d '' bin; do
    codesign --force --options runtime ${SIGN_TIMESTAMP_FLAG} \
      --entitlements "${ENTITLEMENTS}" \
      --sign "${IDENTITY}" "${bin}"
  done
fi

find "${APP_BUNDLE}/Contents/MacOS" -type f -perm +111 -print0 | while IFS= read -r -d '' bin; do
  codesign --force --options runtime ${SIGN_TIMESTAMP_FLAG} \
    --entitlements "${ENTITLEMENTS}" \
    --sign "${IDENTITY}" "${bin}"
done

echo "=== [3/6] Sealing outer TwoolKit.app bundle with Hardened Runtime & Entitlements ==="
codesign --force --deep --options runtime ${SIGN_TIMESTAMP_FLAG} \
  --entitlements "${ENTITLEMENTS}" \
  --sign "${IDENTITY}" "${APP_BUNDLE}"

echo "=== [4/6] Validating TwoolKit.app signature (--verify --deep --strict) ==="
codesign --verify --deep --strict --verbose=2 "${APP_BUNDLE}"
codesign -dv --verbose=4 "${APP_BUNDLE}" 2>&1 | grep -E "Identifier=|Format=|CodeDirectory|Signature=|Info.plist=|Sealed Resources=" || true

echo "=== [5/6] Signing DMG disk image (${DMG_FILE}) ==="
if [[ -f "${DMG_FILE}" ]]; then
  codesign --force ${SIGN_TIMESTAMP_FLAG} --sign "${IDENTITY}" "${DMG_FILE}"
  codesign --verify --verbose=2 "${DMG_FILE}"
fi

echo "=== [6/6] Apple Notarization & Stapling Check ==="
if [[ "${IDENTITY}" != "-" ]] && [[ -f "${DMG_FILE}" ]]; then
  if [[ -n "${APPLE_ID:-}" && -n "${APPLE_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]]; then
    echo "Submitting ${DMG_FILE} to Apple Notary Service via APPLE_ID..."
    xcrun notarytool submit "${DMG_FILE}" \
      --apple-id "${APPLE_ID}" \
      --password "${APPLE_PASSWORD}" \
      --team-id "${APPLE_TEAM_ID}" \
      --wait
    xcrun stapler staple "${APP_BUNDLE}"
    xcrun stapler staple "${DMG_FILE}"
    xcrun stapler validate "${DMG_FILE}"
    spctl --assess --type execute --verbose=4 "${APP_BUNDLE}"
    spctl --assess --type open --context context:primary-signature --verbose=4 "${DMG_FILE}"
  elif [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_ISSUER:-}" && -n "${APPLE_API_KEY_PATH:-}" ]]; then
    echo "Submitting ${DMG_FILE} to Apple Notary Service via App Store Connect API Key..."
    xcrun notarytool submit "${DMG_FILE}" \
      --key "${APPLE_API_KEY_PATH}" \
      --key-id "${APPLE_API_KEY}" \
      --issuer "${APPLE_API_ISSUER}" \
      --wait
    xcrun stapler staple "${APP_BUNDLE}"
    xcrun stapler staple "${DMG_FILE}"
    xcrun stapler validate "${DMG_FILE}"
    spctl --assess --type execute --verbose=4 "${APP_BUNDLE}"
    spctl --assess --type open --context context:primary-signature --verbose=4 "${DMG_FILE}"
  else
    echo "SKIPPED NOTARIZATION: Developer ID signed, but APPLE_ID/APPLE_PASSWORD/APPLE_TEAM_ID (or API key) are not set."
  fi
else
  echo "SKIPPED NOTARIZATION: Requires a paid 'Developer ID Application' certificate in APPLE_SIGNING_IDENTITY and Apple Notary credentials."
fi
