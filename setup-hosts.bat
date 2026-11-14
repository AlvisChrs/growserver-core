@echo off
:: Script to add Growtopia localhost redirection to Windows hosts file
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Script ini memerlukan hak akses Administrator.
    echo Klik kanan file ini dan pilih "Run as administrator".
    pause
    exit /b 1
)

set HOSTS_FILE=%WINDIR%\System32\drivers\etc\hosts
echo [*] Menambahkan entri GTPS ke %HOSTS_FILE%...

findstr /C:"login.growserver.test" "%HOSTS_FILE%" >nul
if %errorLevel% equ 0 (
    echo [i] Entri GTPS sudah ada di file hosts!
) else (
    echo. >> "%HOSTS_FILE%"
    echo # Growtopia Private Server Localhost >> "%HOSTS_FILE%"
    echo 127.0.0.1 login.growserver.test >> "%HOSTS_FILE%"
    echo 127.0.0.1 cdn.growserver.test >> "%HOSTS_FILE%"
    echo 127.0.0.1 growtopia1.com >> "%HOSTS_FILE%"
    echo 127.0.0.1 growtopia2.com >> "%HOSTS_FILE%"
    echo 127.0.0.1 www.growtopia1.com >> "%HOSTS_FILE%"
    echo 127.0.0.1 www.growtopia2.com >> "%HOSTS_FILE%"
    echo [OK] Entri GTPS berhasil ditambahkan ke file hosts!
)

ipconfig /flushdns >nul
echo [OK] DNS Cache di-flush.
echo Selesai! Anda siap bermain di server lokal.
pause
