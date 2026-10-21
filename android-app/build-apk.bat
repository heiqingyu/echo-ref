@echo off
REM ============================================================
REM  EchoRef APK build script (no Gradle, pure command line)
REM  Usage: build-apk.bat
REM  Output: dist\EchoRef.apk (signed, ready to install)
REM          ..\EchoRef-v<version>.apk (same file, version-stamped copy in repo root)
REM  NOTE: keep this file ASCII-only (GBK console garbles UTF-8)
REM ============================================================
setlocal enabledelayedexpansion

set SDK=D:\android-sdk
set BT=%SDK%\build-tools\34.0.0
set PLAT=%SDK%\platforms\android-34\android.jar
set JAVAC="C:\Program Files\Java\jdk-17\bin\javac.exe"
set KEYTOOL="C:\Program Files\Java\jdk-17\bin\keytool.exe"

set HERE=%~dp0
set BUILD=%HERE%build
set DIST=%HERE%dist

REM Version: single source of truth = android-app\VERSION
REM   line 1 = versionName (shown to users)
REM   line 2 = versionCode (must increase to allow upgrade)
REM Bump BOTH on every feature change.
set VNAME=
if exist "%HERE%VERSION" set /p VNAME=<"%HERE%VERSION"
if not defined VNAME set "VNAME=0.0.0"
echo.
echo [v] version %VNAME% (see android-app\VERSION)

echo.
echo [0/7] build site (docs = 4 tabs: EF / segments / peds / calc) and sync to assets...
pushd "%HERE%.."
call node build-www.js
if errorlevel 1 (popd & goto :fail)
popd
REM Pack docs/index.html (4 tabs). The standalone "valve assessment" tab is NOT wanted
REM in the app: its reading items already live in the formula tab ("valve" group),
REM only the 5 valve calculators depend on that page. Segments tab MUST stay.
copy /y "%HERE%..\docs\index.html" "%HERE%assets\index.html" >nul
if errorlevel 1 goto :fail

echo [1/7] prepare dirs...
if exist "%BUILD%" rmdir /s /q "%BUILD%"
mkdir "%BUILD%\obj" 2>nul
mkdir "%BUILD%\gen" 2>nul
mkdir "%BUILD%\apk" 2>nul
if exist "%DIST%" rmdir /s /q "%DIST%"
mkdir "%DIST%" 2>nul

echo [1b/7] generate AndroidManifest with version...
node "%HERE%gen-manifest.js"
if errorlevel 1 goto :fail

echo [2/7] aapt2 compile resources...
call "%BT%\aapt2.exe" compile --dir "%HERE%res" -o "%BUILD%\res.zip"
if errorlevel 1 goto :fail

echo [3/7] aapt2 link (R.java + base apk)...
call "%BT%\aapt2.exe" link -o "%BUILD%\base.apk" -I "%PLAT%" --manifest "%BUILD%\AndroidManifest.gen.xml" --java "%BUILD%\gen" --auto-add-overlay "%BUILD%\res.zip"
if errorlevel 1 goto :fail

echo [4/7] javac compile java...
REM target 8 + bootclasspath: required for android.jar (target 11 forbids -bootclasspath)
call %JAVAC% -encoding UTF-8 -source 8 -target 8 -bootclasspath "%PLAT%" -classpath "%PLAT%" -d "%BUILD%\obj" "%HERE%src\com\echoref\app\MainActivity.java" "%BUILD%\gen\com\echoref\app\R.java"
if errorlevel 1 goto :fail

echo [5/7] d8 dex...
REM d8 does not expand wildcards; jar the classes first then feed the jar
call "C:\Program Files\Java\jdk-17\bin\jar.exe" cf "%BUILD%\classes.jar" -C "%BUILD%\obj" .
if errorlevel 1 goto :fail
call "%BT%\d8.bat" --release --lib "%PLAT%" --output "%BUILD%\apk" "%BUILD%\classes.jar"
if errorlevel 1 goto :fail

echo [6/7] pack dex + assets into apk...
copy /y "%BUILD%\base.apk" "%BUILD%\unsigned.apk" >nul
python "%HERE%pack-assets.py" "%BUILD%\unsigned.apk" "%HERE%assets\index.html" classes.dex "%BUILD%\apk\classes.dex"
if errorlevel 1 goto :fail

echo [7/7] sign...
REM Keystore password comes from the KS_PASS environment variable.
REM Set it before running, e.g.:  set KS_PASS=yourpassword
REM (Per-machine default lives in keystore.properties, which is gitignored.)
if not defined KS_PASS (
    if exist "%HERE%keystore.properties" (
        for /f "usebackq tokens=1,* delims==" %%A in ("%HERE%keystore.properties") do (
            if /i "%%A"=="KS_PASS" set "KS_PASS=%%B"
        )
    )
)
if not defined KS_PASS (
    echo [ERROR] KS_PASS not set.
    echo         Create android-app\keystore.properties with a line:
    echo             KS_PASS=yourpassword
    echo         or set the environment variable KS_PASS before building.
    goto :fail
)
if not exist "%HERE%keystore.jks" (
    echo   generate keystore...
    call %KEYTOOL% -genkeypair -keystore "%HERE%keystore.jks" -alias echoref -validity 10000 -keyalg RSA -keysize 2048 -storepass "%KS_PASS%" -keypass "%KS_PASS%" -dname "CN=EchoRef, OU=Personal, O=Personal, C=CN"
    if errorlevel 1 goto :fail
)
call "%BT%\apksigner.bat" sign --ks "%HERE%keystore.jks" --ks-key-alias echoref --ks-pass pass:%KS_PASS% --key-pass pass:%KS_PASS% --out "%DIST%\EchoRef.apk" "%BUILD%\unsigned.apk"
if errorlevel 1 goto :fail

REM Copy the signed APK to the repo root with a version-stamped name
REM (e.g. EchoRef-v1.3.10.apk) so it is easy to find, and drop older ones
REM so the root always holds exactly the latest build.
REM NOTE: done by Node (finalize-apk.js) instead of cmd copy/for/del:
REM   cmd's `for /f` + `dir /b` + `del` is unreliable when driven from
REM   Git Bash, and copy dropped the .apk extension from the target name.
node "%HERE%finalize-apk.js"
if errorlevel 1 goto :fail

echo.
echo ============================================
echo  BUILD OK: %DIST%EchoRef.apk  (v%VNAME%)
echo  COPY: %HERE%..\EchoRef-v%VNAME%.apk
echo ============================================
exit /b 0

:fail
echo.
echo [FAILED] build aborted, see errors above.
exit /b 1
