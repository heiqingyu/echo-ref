# push.ps1 -- build + commit + push EchoRef to GitHub
# Usage:
#   cd <project-directory>
#   powershell -ExecutionPolicy Bypass -File .\push.ps1

# Show UTF-8 correctly in the console
try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
    $OutputEncoding = New-Object System.Text.UTF8Encoding $false
} catch { }

$Git = "<git-path>"

Set-Location -Path $PSScriptRoot

if (-not (Test-Path $Git)) {
    Write-Host "[ERROR] git.exe not found:"
    Write-Host "  $Git"
    exit 1
}

Write-Host "=========================================="
Write-Host "  Push EchoRef to GitHub"
Write-Host "=========================================="
Write-Host ""

Write-Host "[1/3] Building web pages..."
& node build-www.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build failed. Aborted."
    exit 1
}
Write-Host ""

Write-Host "[2/3] Committing changes..."
& $Git add -A
$staged = ((& $Git diff --cached --name-only) -join "").Trim()
if ($staged.Length -gt 0) {
    & $Git -c user.name="heiqingyu" -c user.email="heiqingyu@users.noreply.github.com" commit -m "update web pages" | Out-Null
    Write-Host "  committed"
} else {
    Write-Host "  nothing to commit"
}
Write-Host ""

Write-Host "[3/3] Pushing to GitHub..."
# If no upstream tracking is set up yet, use -u for the first push
$upstream = ((& $Git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null) -join "").Trim()
if ($upstream.Length -eq 0) {
    Write-Host "  (first push, setting upstream)"
    & $Git push -u origin main
} else {
    & $Git push
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Push failed. Common causes:"
    Write-Host "  - Login required: user = heiqingyu, password = Personal Access Token"
    Write-Host "  - Network: github.com is unstable, just retry"
    exit 1
}

Write-Host ""
Write-Host "=========================================="
Write-Host "  DONE.  https://heiqingyu.github.io/echo-ref/"
Write-Host "=========================================="
