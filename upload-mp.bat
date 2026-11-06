@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PROJ=%CD%"
set "VER="
for /f "tokens=2 delims='" %%a in ('findstr /c:"const APP_VERSION" miniprogram\utils\version.js') do set "VER=%%a"
if "%VER%"=="" (
  echo [错误] 无法从 miniprogram\utils\version.js 读取版本号
  pause
  exit /b 1
)
set "DESC=修复切面学习与公式集白屏：拆分判读数据文件，避免单文件超500KB跳过转译"

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

echo [1/4] 包体自检（单文件 500KB 门槛 / 主包 2MB 上限）...
node check-mp-size.js
if errorlevel 2 (
  echo.
  echo [错误] 包体自检未通过，见上方阻塞项。
  echo        超 500KB 的 JS 会被跳过转译，上传包不完整，真机白屏。
  pause
  exit /b 1
)
echo.
echo [2/4] 检查开发者工具登录状态...
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
echo [3/4] 上传中（首次可能要 1-3 分钟）...
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
echo  接下来（按顺序做，别跳）：
echo    1. 看上方上传日志的「已跳过处理」列表——必须为空
echo    2. 设为体验版，用手机打开，逐页点一遍
echo    3. 确认无白屏，再去公众平台提交审核
echo ============================================
pause
