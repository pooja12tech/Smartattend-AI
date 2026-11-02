@echo off
title SmartAttend-AI SSL Certificate Trust Installer
echo =======================================================================
echo   SmartAttend-AI - Localhost SSL Certificate Trust Installer
echo =======================================================================
echo.
echo Installing SmartAttend Local Development CA into Windows Trusted Store...
echo.
echo [IMPORTANT] Look at the Windows "Security Warning" popup on your screen
echo             and click "YES" to permanently trust https://localhost:5173
echo.
certutil -user -addstore Root "%~dp0frontend\certs\ca.crt"
echo.
if %errorlevel% equ 0 (
    echo =======================================================================
    echo  SUCCESS! Certificate is now permanently trusted by Windows.
    echo  Chrome and Edge will now recognize https://localhost:5173 as SECURE.
    echo.
    echo  Please close and reopen your browser or app, or press Refresh (Ctrl+R).
    echo =======================================================================
) else (
    echo =======================================================================
    echo  Notice: Installation was cancelled. If prompted, please click "Yes".
    echo =======================================================================
)
echo.
echo Press any key to close this window.
pause >nul
