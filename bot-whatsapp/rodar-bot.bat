@echo off
chcp 65001 >nul
title Achadinhos - Bot WhatsApp
cd /d "%~dp0"

:loop
node --env-file=.env bot.mjs
if %errorlevel%==2 (
  echo.
  echo  Ja existe outro bot rodando. Feche esta janela.
  pause
  exit
)
echo.
echo  O bot parou. Reiniciando em 10 segundos... (feche esta janela pra desligar de vez)
timeout /t 10 /nobreak >nul
goto loop
