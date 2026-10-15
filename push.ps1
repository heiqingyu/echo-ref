# push.ps1 -- 构建 + 提交 + 推送「心脏超声参考值」到 GitHub
# 用法：在 PowerShell 里执行
#   cd <project-directory>
#   powershell -ExecutionPolicy Bypass -File .\push.ps1
# 若提示脚本被禁止运行，用上面那条带 -ExecutionPolicy Bypass 的命令即可。

$ErrorActionPreference = "Stop"

$Git = "<git-path>"

Set-Location -Path $PSScriptRoot

if (-not (Test-Path $Git)) {
    Write-Host "[ERROR] git.exe 未找到：" -ForegroundColor Red
    Write-Host "  $Git"
    exit 1
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  推送「心脏超声参考值」到 GitHub" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] 重新构建网页..." -ForegroundColor Yellow
node build-www.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] 构建失败，已中止。" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "[2/3] 提交改动..." -ForegroundColor Yellow
& $Git add -A
& $Git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    & $Git -c user.name="heiqingyu" -c user.email="heiqingyu@users.noreply.github.com" commit -m "更新网页内容"
    Write-Host "  已提交" -ForegroundColor Green
} else {
    Write-Host "  没有需要提交的改动"
}
Write-Host ""

Write-Host "[3/3] 推送到 GitHub..." -ForegroundColor Yellow
& $Git push
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] 推送失败，常见原因：" -ForegroundColor Red
    Write-Host "  - 需要登录：用户名填 heiqingyu，密码填 Personal Access Token"
    Write-Host "  - 网络不通：github.com 访问不稳定，重试一次"
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  ✓ 推送完成" -ForegroundColor Green
Write-Host "  1~2 分钟后访问：https://heiqingyu.github.io/echo-ref/" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
