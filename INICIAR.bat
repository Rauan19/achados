@echo off
chcp 65001 >nul
title Achadinhos
cd /d "%~dp0"

echo.
echo  Ligando o sistema e o bot do WhatsApp...
echo  (pode minimizar as janelas pretas, mas NAO feche: elas sao o sistema rodando)
echo.

if not exist "conversor-links\node_modules" (
  echo  Primeira vez: instalando dependencias, aguarde...
  call npm --prefix conversor-links install
  call npm --prefix bot-whatsapp install
)

start "Achadinhos - Sistema" /min cmd /k "npm --prefix conversor-links run dev"
start "Achadinhos - Bot WhatsApp" /min cmd /c "bot-whatsapp\rodar-bot.bat"

timeout /t 8 /nobreak >nul
start "" "http://localhost:3000/whatsapp"
exit
