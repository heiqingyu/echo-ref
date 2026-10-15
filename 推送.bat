@echo off
REM ══════════════════════════════════════════════════════════
REM  推送脚本 —— 双击运行即可把本地改动推到 GitHub
REM  用途：PowerShell 里敲 git 找不到（Git 未加入 PATH），
REM        所以这里用完整路径调用 集成环境 自带的 Git。
REM ══════════════════════════════════════════════════════════
chcp 65001 >nul
setlocal

set "GIT=<git-path>"
cd /d "%~dp0"

if not exist "%GIT%" (
  echo [错误] 没找到 git.exe：
  echo   %GIT%
  echo 请确认 集成环境 的 PortableGit 是否还在该位置。
  pause
  exit /b 1
)

echo ══════════════════════════════════════════
echo   推送「心脏超声参考值」到 GitHub
echo ══════════════════════════════════════════
echo.

echo [1/3] 重新构建网页（生成 www\ 与 docs\）
node build-www.js
if errorlevel 1 (
  echo [错误] 构建失败，已中止推送。
  pause
  exit /b 1
)
echo.

echo [2/3] 提交改动
"%GIT%" add -A
"%GIT%" diff --cached --quiet
if errorlevel 1 (
  "%GIT%" -c user.name="heiqingyu" -c user.email="heiqingyu@users.noreply.github.com" commit -m "更新网页内容"
) else (
  echo 没有需要提交的改动。
)
echo.

echo [3/3] 推送到 GitHub
"%GIT%" push
if errorlevel 1 (
  echo.
  echo [错误] 推送失败。常见原因：
  echo   - 需要登录：用户名填 heiqingyu，密码填 Personal Access Token
  echo   - 网络不通：github.com 访问不稳定，重试一次
  pause
  exit /b 1
)

echo.
echo ══════════════════════════════════════════
echo   ✓ 推送完成
echo   1~2 分钟后访问：https://heiqingyu.github.io/echo-ref/
echo ══════════════════════════════════════════
pause
