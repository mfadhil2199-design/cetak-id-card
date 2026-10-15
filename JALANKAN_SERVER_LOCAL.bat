@echo off
title CetakID Pro Server (Localhost)
echo ========================================================
echo       Menjalankan Web Server CetakID Pro (Localhost)
echo ========================================================
echo.
echo Server aktif pada: http://localhost:8080
echo Tekan CTRL + C untuk menghentikan server.
echo.

start "" "http://localhost:8080"
python -m http.server 8080
pause
