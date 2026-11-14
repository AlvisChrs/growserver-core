@echo off
title GrowServer Console
cd /d "%~dp0"

echo ===================================================
echo               GrowServer Local Console
echo ===================================================
echo Host:    127.0.0.1
echo UDP:     17091
echo HTTPS:   443 (Caddy Proxy)
echo ===================================================
echo.

".cache\bin\bun.exe" run src/index.ts start:local
pause
