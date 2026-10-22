@echo off
chcp 936 >nul
setlocal enabledelayedexpansion

REM ============================================================
REM  EchoRef 同步 + 推送脚本（双击即可）
REM  本机 git 不在系统 PATH，这里显式指定 PortableGit
REM  流程：fetch -> rebase -> push，自动解决 non-fast-forward
REM  说明：本文件必须保存为 GBK 编码，用 UTF-8 存中文注释会让 cmd 断行报错
REM ============================================================

set "GIT=C:\Users\wlb33\.workbuddy\binaries\PortableGit\versions\1.3.0\cmd\git.exe"
if not exist "%GIT%" (
  echo [ERROR] 找不到 git.exe: %GIT%
  goto :end
)

set "HOME=C:\Users\wlb33"
set "USERPROFILE=C:\Users\wlb33"
set "GIT_SSH_COMMAND=ssh -i ""C:/Users/wlb33/.ssh/id_ed25519_mcloud"" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -o ServerAliveInterval=15"

cd /d "%~dp0"

echo ============================================================
echo   [1/4] 当前分支与最新提交
echo ============================================================
"%GIT%" rev-parse --abbrev-ref HEAD
"%GIT%" log --oneline -1
echo.
echo --- 未提交的改动 ---
"%GIT%" status --short
echo.

if /i "%~1"=="status" goto :end

"%GIT%" diff --quiet
if errorlevel 1 (
  echo [ERROR] 还有未提交的改动，rebase 会被拒绝。
  echo         先 git add -A ^&^& git commit -m "..."，再双击本脚本。
  goto :end
)

echo ============================================================
echo   [2/4] 拉取远端改动（含网页端上传的文件，几十 MB，慢是正常的）
echo ============================================================
"%GIT%" fetch --progress origin main
if errorlevel 1 (
  echo.
  echo [ERROR] 拉取失败，多为网络中断。
  echo         直接再双击一次本脚本重试；连续失败再找助手。
  goto :end
)

echo.
echo ============================================================
echo   [3/4] 本地提交对齐到远端最新（rebase）
echo ============================================================
"%GIT%" rebase origin/main
if errorlevel 1 (
  echo.
  echo [ERROR] 变基出现冲突，已中止本次变基，仓库保持原样。
  echo         把上面几行提示发给助手处理，不要手动乱改。
  "%GIT%" rebase --abort
  goto :end
)

echo.
echo ============================================================
echo   [4/4] 推送到 GitHub
echo ============================================================
"%GIT%" push origin main
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
