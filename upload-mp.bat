@echo off
chcp 936 >nul
cd /d "%~dp0"
set "PROJ=%CD%"
set "VER="
for /f "tokens=2 delims='" %%a in ('findstr /c:"const APP_VERSION" miniprogram\utils\version.js') do set "VER=%%a"
if "%VER%"=="" (
  echo [错误] 无法从 miniprogram\utils\version.js 读取版本号
  pause
  exit /b 1
)
set "DESC=内容与计算器说明更新"

echo ============================================
echo  上传小程序 v%VER%
echo  项目: %PROJ%
echo ============================================
echo.

set "IDE=D:/微信web开发者工具"
if not exist "%IDE%\cli.bat" (
  echo [错误] 未找到开发者工具 CLI: %IDE%\cli.bat
  echo 请修改本脚本第 20 行的 IDE 路径。
  pause
  exit /b 1
)

echo [1/3] 检查开发者工具登录状态...
cd /d "%IDE%"
call cli.bat islogin
if errorlevel 1 (
  echo.
  echo [错误] 连不上开发者工具。
  echo   1. 先手动打开「微信开发者工具」并登录
  echo   2. 设置 - 安全设置 - 服务端口 打开
  echo   3. 再双击本脚本
  pause
  exit /b 1
)

echo.
echo [2/3] 上传中（首次可能要 1-3 分钟）...
call cli.bat upload --project "%PROJ%" -v %VER% -d "%DESC%"
if errorlevel 1 (
  echo.
  echo [错误] 上传失败，请把上方报错发给 AI。
  pause
  exit /b 1
)

echo.
echo ============================================
echo  上传成功 v%VER%
echo  接下来：微信公众平台 - 版本管理 - 提交审核 或 设为体验版
echo ============================================
pause
