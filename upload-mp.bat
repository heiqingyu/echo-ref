@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PROJ=%~dp0"
set "VER=1.3.12"
set "DESC=计算器说明补全（临床意义/参考标准/判读要点）+ 随访与术中评估 + 特殊临床场景"

echo ============================================
echo  上传小程序 v%VER%
echo  项目: %PROJ%
echo ============================================
echo.

echo [1/2] 检查开发者工具登录状态...
cd /d "D:\微信web开发者工具"
call cli.bat islogin
if errorlevel 1 (
  echo.
  echo [错误] 无法连接开发者工具。
  echo 请先手动打开「微信开发者工具」并登录，
  echo 确认「设置 - 安全设置 - 服务端口」已开启，
  echo 然后重新双击本脚本。
  pause
  exit /b 1
)

echo.
echo [2/2] 开始上传...
call cli.bat upload --project "%PROJ%" -v %VER% -d "%DESC%"
if errorlevel 1 (
  echo.
  echo [错误] 上传失败。请查看上方报错。
  pause
  exit /b 1
)

echo.
echo ============================================
echo  上传成功 v%VER%
echo ============================================
pause
