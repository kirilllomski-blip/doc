@echo off
chcp 65001 >nul
title IceBel Contracts Web App
echo ========================================================
echo   IceBel Contracts — ООО «АйсикБел»
echo   Запуск веб-приложения на http://127.0.0.1:8000
echo ========================================================
echo.

python run_local.py
pause
