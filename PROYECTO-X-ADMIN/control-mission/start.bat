@echo off
REM ===========================================
REM CONTROL MISSION - Script de Inicio
REM ===========================================

echo.
echo ============================================
echo   CONTROL MISSION - Iniciando Sistema
echo ============================================
echo.

REM Verificar si node esta instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no esta instalado!
    echo Instala Node.js desde https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js detectado: 
node --version
echo.

REM Verificar si node_modules existe
if not exist "node_modules\" (
    echo [INFO] Instalando dependencias por primera vez...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Error instalando dependencias
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencias instaladas
    echo.
)

REM Verificar archivo .env
if not exist ".env" (
    echo [INFO] Creando archivo .env desde ejemplo...
    copy .env.example .env
    echo.
    echo [AVISO] Configura tu TELEGRAM_BOT_TOKEN en .env
    echo.
)

REM Iniciar servidor
echo ============================================
echo   Iniciando servidor en puerto 4000
echo   Dashboard: http://localhost:4000
echo ============================================
echo.
echo Presiona CTRL+C para detener
echo.

node backend/server.js

pause
