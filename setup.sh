#!/bin/bash
# ============================================
# Script de Configuración Inicial - Incubant
# Para Linux/Mac
# ============================================

echo ""
echo "============================================"
echo "  INCUBANT - Configuración Inicial"
echo "============================================"
echo ""

# Verificar Node.js instalado
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js no está instalado."
    echo "Descarga e instala desde: https://nodejs.org/"
    exit 1
fi

echo "[OK] Node.js detectado:"
node --version
echo ""

# Verificar si existe .env
if [ ! -f ".env" ]; then
    echo "[INFO] Creando archivo .env desde .env.example..."
    cp .env.example .env
    echo ""
    echo "[IMPORTANTE] Edita el archivo .env y configura:"
    echo "  - DATABASE_URL"
    echo "  - DIRECT_URL"
    echo "  - SESSION_SECRET"
    echo "  - VITE_SUPABASE_URL"
    echo "  - VITE_SUPABASE_ANON_KEY"
    echo ""
    echo "Puedes editar .env con: nano .env"
    echo ""
    read -p "Presiona Enter para continuar..."
else
    echo "[OK] Archivo .env ya existe"
    echo ""
fi

# Instalar dependencias
echo "[1/3] Instalando dependencias..."
npm install

if [ $? -ne 0 ]; then
    echo "[ERROR] Falló la instalación de dependencias"
    exit 1
fi

echo ""
echo "[OK] Dependencias instaladas correctamente"
echo ""

# Generar Prisma Client
echo "[2/3] Generando Prisma Client..."
npx prisma generate

if [ $? -ne 0 ]; then
    echo "[WARNING] Prisma generate falló, continuando..."
else
    echo "[OK] Prisma Client generado"
fi

echo ""

# Verificar .env configurado
echo "[3/3] Verificando configuración..."
if grep -q "DATABASE_URL=" .env; then
    echo "[OK] DATABASE_URL configurada"
else
    echo "[WARNING] DATABASE_URL no configurada en .env"
fi

if grep -q "VITE_SUPABASE_URL=" .env; then
    echo "[OK] VITE_SUPABASE_URL configurada"
else
    echo "[WARNING] VITE_SUPABASE_URL no configurada en .env"
fi

echo ""
echo "============================================"
echo "  Configuración Completa!"
echo "============================================"
echo ""
echo "Siguientes pasos:"
echo ""
echo "1. Si no lo has hecho, edita .env con tus credenciales de Supabase"
echo "2. Ejecuta las migraciones en Supabase (ver DEPLOYMENT.md)"
echo "3. Para desarrollar: npm run dev"
echo "4. Para build de producción: npm run build"
echo ""
echo "Para más información, lee: DEPLOYMENT.md"
echo ""
