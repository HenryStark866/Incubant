@echo off
REM ============================================
REM Script de Configuración Inicial - Incubant
REM Para Windows
REM ============================================

echo.
echo ============================================
echo   INCUBANT - Configuración Inicial
echo ============================================
echo.

REM Verificar Node.js instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Descarga e instala desde: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js detectado:
node --version
echo.

REM Verificar si existe .env
if not exist ".env" (
    echo [INFO] Creando archivo .env desde .env.example...
    copy .env.example .env
    echo.
    echo [IMPORTANTE] Edita el archivo .env y configura:
    echo   - DATABASE_URL
    echo   - DIRECT_URL
    echo   - SESSION_SECRET
    echo   - VITE_SUPABASE_URL
    echo   - VITE_SUPABASE_ANON_KEY
    echo.
    echo Puedes editar .env con: notepad .env
    echo.
    pause
) else (
    echo [OK] Archivo .env ya existe
    echo.
)

REM Instalar dependencias
echo [1/3] Instalando dependencias...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo la instalacion de dependencias
    pause
    exit /b 1
)

echo.
echo [OK] Dependencias instaladas correctamente
echo.

REM Generar Prisma Client
echo [2/3] Generando Prisma Client...
call npx prisma generate

if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Prisma generate fallo, continuando...
) else (
    echo [OK] Prisma Client generado
)

echo.

REM Verificar .env configurado
echo [3/3] Verificando configuracion...
findstr /C:"DATABASE_URL=" .env >nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] DATABASE_URL no configurada en .env
) else (
    echo [OK] DATABASE_URL configurada
)

findstr /C:"VITE_SUPABASE_URL=" .env >nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] VITE_SUPABASE_URL no configurada en .env
) else (
    echo [OK] VITE_SUPABASE_URL configurada
)

echo.
echo ============================================
echo   Configuración Completa!
echo ============================================
echo.
echo Siguientes pasos:
echo.
echo 1. Si no lo has hecho, edita .env con tus credenciales de Supabase
echo 2. Ejecuta las migraciones en Supabase (ver DEPLOYMENT.md)
echo 3. Para desarrollar: npm run dev
echo 4. Para build de produccion: npm run build
echo.
echo Para mas informacion, lee: DEPLOYMENT.md
echo.
pause
