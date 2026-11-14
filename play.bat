@echo off
title GrowServer - Play
cd /d "%~dp0"

echo ===================================================
echo               GrowServer 1-Click Play
echo ===================================================
echo [1/2] Menyalakan server di background...

start "GrowServer Process" /min ".cache\bin\bun.exe" run src/index.ts start:local

echo Menunggu server siap (3 detik)...
timeout /t 3 /nobreak >nul

echo [2/2] Membuka game Growtopia...
if exist "%LOCALAPPDATA%\Growtopia\Growtopia.exe" (
    start "" "%LOCALAPPDATA%\Growtopia\Growtopia.exe"
) else (
    echo [!] Growtopia.exe tidak ditemukan di folder default.
)

echo.
echo ===================================================
echo Server aktif! Anda bisa login dengan:
echo   GrowID:   Dark
echo   Password: 12345678
echo.
echo JANGAN tutup jendela ini saat sedang bermain!
echo Tekan sembarang tombol di sini jika sudah selesai bermain
echo untuk mematikan server secara otomatis.
echo ===================================================
pause >nul

echo Mematikan server...
taskkill /f /im bun.exe >nul 2>&1
taskkill /f /im caddy.exe >nul 2>&1
echo Server berhasil dimatikan.
timeout /t 2 /nobreak >nul
