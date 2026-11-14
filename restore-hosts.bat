@echo off
:: Script to remove Growtopia localhost redirection from Windows hosts file
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Script ini memerlukan hak akses Administrator.
    echo Klik kanan file ini dan pilih "Run as administrator".
    pause
    exit /b 1
)

set HOSTS_FILE=%WINDIR%\System32\drivers\etc\hosts
echo [*] Menghapus entri GTPS dari hosts...

powershell -Command "$content = Get-Content '%HOSTS_FILE%' | Where-Object { $_ -notmatch 'growserver|growtopia1|growtopia2' }; Set-Content '%HOSTS_FILE%' $content"
ipconfig /flushdns >nul
echo [OK] File hosts telah dikembalikan ke kondisi semula.
pause
