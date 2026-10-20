@echo off
chcp 65001 >nul
setlocal

REM ============================================================
REM  EchoRef 推送脚本
REM  本机 git 不在系统 PATH（已加入用户 PATH，但旧终端需重开）
REM  这里仍显式指定 PortableGit，避免依赖 PATH 是否生效
REM ============================================================

set "GITDIR=C:\Users\wlb33\.workbuddy\binaries\PortableGit\versions\1.3.0\cmd"
set "GIT=%GITDIR%\git.exe"
if not exist "%GIT%" (
  echo [ERROR] 找不到 git.exe: %GIT%
  goto :end
)

REM ── 显式 HOME：PowerShell 里 HOME 为空会让 ssh 读不到 ~/.ssh/config ──
set "HOME=C:\Users\wlb33"
set "USERPROFILE=C:\Users\wlb33"

REM ── GitHub 的 443 不通，只能走 SSH（22），密钥显式指定 ──
set "GIT_SSH_COMMAND=ssh -i ""C:/Users/wlb33/.ssh/id_ed25519_mcloud"" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no"

cd /d "%~dp0"

echo ============================================================
echo   当前分支 / 最新提交
echo ============================================================
"%GIT%" rev-parse --abbrev-ref HEAD
"%GIT%" log --oneline -1
echo.

echo ============================================================
echo   待提交改动
echo ============================================================
"%GIT%" status --short
echo.

if /i "%~1"=="status" goto :end

echo ============================================================
echo   推送到 GitHub
echo ============================================================
"%GIT%" push %*
if errorlevel 1 (
  echo.
  echo [提示] 推送失败。若报 publickey denied，检查密钥文件是否还在：
  echo        C:\Users\wlb33\.ssh\id_ed25519_mcloud
  echo        若报 Connection refused，检查代理是否开着（必要时关掉代理重试）
  goto :end
)

echo.
echo ============================================================
echo   完成   https://heiqingyu.github.io/echo-ref/
echo   Pages 约 1 分钟内刷新
echo ============================================================

:end
echo.
pause
