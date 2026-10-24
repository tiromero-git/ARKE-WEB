@echo off
chcp 65001 >nul
title ARKE Web
cd /d "%~dp0"
echo.
echo ==============================================
echo    ARKE Web - iniciando el sitio en tu compu
echo ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [X] No encuentro Node.js. Instalalo desde https://nodejs.org ^(LTS^) y volve a abrir este archivo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo Node.js %%v encontrado.

if not exist node_modules (
  echo.
  echo [1/3] Instalando librerias ^(solo la primera vez^)...
  call npm install
  if errorlevel 1 ( echo [X] Fallo npm install & pause & exit /b 1 )
)

if not exist .env (
  copy .env.example .env >nul
  node scripts\generar-secreto.js >nul
  echo [2/3] Archivo .env creado con una clave de sesion nueva.
)

if not exist data\arke.db (
  echo.
  echo [3/3] Cargando el catalogo en la base de datos...
  call npm run importar
  if errorlevel 1 ( echo [X] Fallo la importacion & pause & exit /b 1 )
)

echo.
echo Listo. Abriendo http://localhost:3000 ...
echo Para APAGAR el sitio, cerra esta ventana.
echo.
start "" /min cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"
call npm start
pause
