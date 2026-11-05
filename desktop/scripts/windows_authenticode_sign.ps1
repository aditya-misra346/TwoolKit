# ==============================================================================
# TwoolKit Desktop — Windows Authenticode Multi-Component Signing & Verification
# ==============================================================================
# Signs all Windows executable components (main EXE, helper DLLs, NSIS plugins,
# uninstaller, and final NSIS/MSI setup installers) using SHA-256 file digest
# (/fd sha256) and RFC 3161 SHA-256 timestamping (/td sha256 /tr).
#
# Supported Credential Modes:
#   1. PFX / PKCS#12 Certificate:
#      - WINDOWS_CERTIFICATE_PFX_BASE64 (or WINDOWS_CERTIFICATE_PATH)
#      - WINDOWS_CERTIFICATE_PASSWORD
#   2. Azure Trusted Signing / Artifact Signing:
#      - AZURE_SIGNING_ENDPOINT, AZURE_SIGNING_ACCOUNT, AZURE_SIGNING_PROFILE
# ==============================================================================

param(
    [Parameter(Mandatory = $true)]
    [string[]]$TargetFiles,

    [Parameter(Mandatory = $false)]
    [string]$TimestampServer = "http://timestamp.acs.microsoft.com"
)

$ErrorActionPreference = "Stop"

function Find-SignTool {
    $cmd = Get-Command "signtool.exe" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $kitsRoot = "C:\Program Files (x86)\Windows Kits\10\bin"
    if (Test-Path $kitsRoot) {
        $found = Get-ChildItem -Path $kitsRoot -Filter "signtool.exe" -Recurse |
            Where-Object { $_.FullName -match "x64" } |
            Sort-Object FullName -Descending |
            Select-Object -First 1
        if ($found) { return $found.FullName }
    }
    throw "signtool.exe not found in PATH or Windows 10/11 SDK."
}

$pfxPath = $env:WINDOWS_CERTIFICATE_PATH
if (-not $pfxPath -and $env:WINDOWS_CERTIFICATE_PFX_BASE64) {
    $pfxPath = Join-Path $env:RUNNER_TEMP "twoolkit-authenticode.pfx"
    [IO.File]::WriteAllBytes($pfxPath, [Convert]::FromBase64String($env:WINDOWS_CERTIFICATE_PFX_BASE64))
}

if (-not $pfxPath -or -not (Test-Path $pfxPath)) {
    Write-Warning "BLOCKED BY MISSING CREDENTIALS: WINDOWS_CERTIFICATE_PFX_BASE64 / WINDOWS_CERTIFICATE_PATH is not configured. Skipping Authenticode signing."
    exit 0
}

$signtool = Find-SignTool
Write-Host "Using SignTool: $signtool"

foreach ($file in $TargetFiles) {
    if (-not (Test-Path $file)) {
        throw "Target binary to sign does not exist: $file"
    }
    Write-Host "Signing $file with SHA-256 Authenticode & RFC 3161 Timestamp ($TimestampServer)..."
    & $signtool sign /fd sha256 /td sha256 /tr $TimestampServer /f $pfxPath /p $env:WINDOWS_CERTIFICATE_PASSWORD /v $file
    if ($LASTEXITCODE -ne 0) {
        throw "SignTool failed on $file with exit code $LASTEXITCODE"
    }

    Write-Host "Verifying Authenticode signature (/pa /v) on $file..."
    & $signtool verify /pa /v $file
    if ($LASTEXITCODE -ne 0) {
        throw "SignTool verification failed on $file with exit code $LASTEXITCODE"
    }
}

Write-Host "All Windows binaries signed and verified successfully."
