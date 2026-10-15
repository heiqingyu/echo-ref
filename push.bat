@echo off
setlocal
cd /d "%~dp0"

rem ---- Locate git.exe ----
set "GIT="
for %%I in (git.exe) do set "GIT=%%~$PATH:I"
if not defined GIT if exist "%ProgramFiles%\Git\cmd\git.exe" set "GIT=%ProgramFiles%\Git\cmd\git.exe"
if not defined GIT if exist "%ProgramFiles(x86)%\Git\cmd\git.exe" set "GIT=%ProgramFiles(x86)%\Git\cmd\git.exe"
if not defined GIT if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" set "GIT=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"

if not defined GIT goto :nogit

echo ==========================================
echo   Push "EchoRef" to GitHub
echo ==========================================
echo.

echo [1/3] Building web pages...
call node build-www.js
if errorlevel 1 goto :buildfail
echo.

echo [2/3] Committing changes...
"%GIT%" add -A
"%GIT%" diff --cached --quiet
if errorlevel 1 (
  "%GIT%" -c user.name="heiqingyu" -c user.email="heiqingyu@users.noreply.github.com" commit -m "update web pages"
) else (
  echo Nothing to commit.
)
echo.

echo [3/3] Pushing to GitHub...
"%GIT%" push
if errorlevel 1 goto :pushfail

echo.
echo ==========================================
echo   DONE.  https://heiqingyu.github.io/echo-ref/
echo ==========================================
goto :end

:nogit
echo [ERROR] git.exe not found.
echo   Install Git for Windows: https://git-scm.com/download/win
goto :end

:buildfail
echo [ERROR] Build failed. Push aborted.
goto :end

:pushfail
echo.
echo [ERROR] Push failed. Common causes:
echo   - Login required: user = heiqingyu, password = Personal Access Token
echo   - Network: github.com is unstable, just retry
goto :end

:end
echo.
pause
