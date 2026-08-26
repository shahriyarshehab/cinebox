@echo off
setlocal enabledelayedexpansion
title CineBox APK Builder

echo ============================================================
echo   🎬 CineBox Native Android APK Builder
echo ============================================================
echo.

:: Detect Java JDK
set "JAVA_DIR="
for /d %%D in ("%LOCALAPPDATA%\jdk-17\*") do (
    if exist "%%D\bin\java.exe" set "JAVA_DIR=%%D"
)
if not defined JAVA_DIR (
    if exist "%LOCALAPPDATA%\jdk-17\bin\java.exe" set "JAVA_DIR=%LOCALAPPDATA%\jdk-17"
)
if not defined JAVA_DIR (
    for /d %%D in ("%ProgramFiles%\Eclipse Adoptium\jdk-17*") do set "JAVA_DIR=%%D"
)
if not defined JAVA_DIR (
    for /d %%D in ("%ProgramFiles%\Microsoft\jdk-17*") do set "JAVA_DIR=%%D"
)

if defined JAVA_DIR (
    set "JAVA_HOME=%JAVA_DIR%"
    set "PATH=%JAVA_DIR%\bin;%PATH%"
    echo [+] Using Java at: %JAVA_DIR%
) else (
    echo [!] Java 17 not found automatically.
)

:: Detect Android SDK
if not defined ANDROID_HOME (
    if exist "%LOCALAPPDATA%\Android\Sdk" (
        set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
        echo [+] Using Android SDK at: %LOCALAPPDATA%\Android\Sdk
    )
)

:: Detect Gradle
set "GRADLE_CMD="
for /d %%D in ("%LOCALAPPDATA%\gradle-8*") do (
    if exist "%%D\bin\gradle.bat" set "GRADLE_CMD=%%D\bin\gradle.bat"
)

if not defined GRADLE_CMD (
    if exist "%~dp0android\gradlew.bat" (
        set "GRADLE_CMD=%~dp0android\gradlew.bat"
    ) else (
        set "GRADLE_CMD=gradle"
    )
)

echo [+] Using Gradle: %GRADLE_CMD%
echo.
echo [*] Building CineBox Standalone APK...
echo.

cd /d "%~dp0android"
call "%GRADLE_CMD%" assembleDebug --no-daemon

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo   ✅ CineBox APK built successfully!
    echo ============================================================
    if exist "%~dp0android\app\build\outputs\apk\debug\app-debug.apk" (
        copy /y "%~dp0android\app\build\outputs\apk\debug\app-debug.apk" "%~dp0cinebox.apk"
        echo   > Output APK: %~dp0cinebox.apk
    )
    echo ============================================================
) else (
    echo.
    echo [X] Build failed with exit code %ERRORLEVEL%.
)
