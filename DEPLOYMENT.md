# Guía de Despliegue - Incubant Monitor

Esta guía cubre el despliegue completo para producción en **Vercel** (frontend) y **Render** (backend), con **Supabase** como base de datos.

---

## Requisitos Previos

1. **Cuenta en GitHub** - Para el repositorio del código
2. **Cuenta en Supabase** - Para la base de datos PostgreSQL
3. **Cuenta en Vercel** - Para el frontend
4. **Cuenta en Render** - Para el backend API

---

## Paso 1: Configurar Supabase

### 1.1 Crear Proyecto

1. Ve a [supabase.com](https://supabase.com) e inicia sesión
2. Click en **"New Project"**
3. Completa:
   - **Name**: `incubant-monitor`
   - **Database Password**: (guarda esto en un lugar seguro)
   - **Region**: Us-East (N. Virginia) - más cercano a Colombia

### 1.2 Ejecutar Migraciones

1. Ve a **SQL Editor** en el panel de Supabase
2. Click en **"New Query"**
3. Copia y pega el contenido de `supabase/migrations/001_init_schema.sql`
4. Click en **"Run"**

### 1.3 Configurar Storage

1. Ve a **Storage** en el panel
2. Click en **"New Bucket"**
3. Nombre: `evidencias`
4. **Public bucket**: ✅ Activado
5. Click en **"Create bucket"**

Luego ejecuta el script `supabase/storage-setup.sql` en el SQL Editor para configurar las políticas de seguridad.

### 1.4 Obtener Credenciales

Ve a **Settings > API** y copia:

| Variable | Ubicación |
|----------|-----------|
| `DATABASE_URL` | Settings > Database > Connection string (URI) |
| `DIRECT_URL` | Settings > Database > Connection string (Direct) |
| `VITE_SUPABASE_URL` | Settings > API > Project URL |
| `VITE_SUPABASE_ANON_KEY` | Settings > API > anon public key |

---

## Paso 2: Configurar Render (Backend)

### 2.1 Crear Web Service

1. Ve a [render.com](https://render.com) e inicia sesión con GitHub
2. Click en **"New +"** → **"Web Service"**
3. Conecta tu repositorio de GitHub (`HenryStark866/Incubant`)

### 2.2 Configuración del Servicio

| Campo | Valor |
|-------|-------|
| **Name** | `incubant-backend` |
| **Region** | North Virginia (us-east-1) |
| **Branch** | `main` |
| **Root Directory** | (dejar vacío) |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |
| **Instance Type** | `Starter` (gratis) |

### 2.3 Variables de Entorno

En Render, ve a **Environment** y añade:

```
NODE_ENV=production
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
SESSION_SECRET=(generar aleatorio, min 32 caracteres)
VITE_SUPABASE_URL=https://[REF].supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

### 2.4 Deploy

1. Click en **"Create Web Service"**
2. Espera a que el deploy termine (~3-5 minutos)
3. Copia la URL del servicio (ej: `https://incubant-backend.onrender.com`)

---

## Paso 3: Configurar Vercel (Frontend)

### 3.1 Importar Proyecto

1. Ve a [vercel.com](https://vercel.com) e inicia sesión con GitHub
2. Click en **"Add New..."** → **"Project"**
3. Importa tu repositorio `HenryStark866/Incubant`

### 3.2 Configuración de Build

| Campo | Valor |
|-------|-------|
| **Framework Preset** | `Vite` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### 3.3 Variables de Entorno

En Vercel, ve a **Settings > Environment Variables** y añade:

```
VITE_SUPABASE_URL=https://[REF].supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
GEMINI_API_KEY=(opcional)
```

### 3.4 Actualizar vercel.json

**IMPORTANTE**: Actualiza la URL de Render en `vercel.json`:

```json
{
    "rewrites": [
        {
            "source": "/api/(.*)",
            "destination": "https://tu-backend-en-render.onrender.com/api/$1"
        }
    ]
}
```

### 3.5 Deploy

1. Click en **"Deploy"**
2. Espera a que termine (~2-3 minutos)
3. Tu app está en: `https://incubant-monitor.vercel.app`

---

## Paso 4: Verificación

### 4.1 Health Check

Visita:
- Frontend: `https://tu-app.vercel.app`
- Backend: `https://tu-backend.onrender.com/api/health`
- DB Health: `https://tu-backend.onrender.com/api/health-db`

### 4.2 Login de Prueba

Usa las credenciales predefinidas:

| Usuario | PIN | Rol |
|---------|-----|-----|
| `admin` | `4753` | JEFE |
| `elkin-cavadia` | `11168` | JEFE |
| `jhon-piedrahita` | `jp2026` | SUPERVISOR |
| `juan-alejandro` | `1111` | OPERARIO |

---

## Paso 5: Instalar en Dispositivos Móviles

### iOS (iPhone/iPad)

1. Abre Safari en tu dispositivo
2. Ve a `https://tu-app.vercel.app`
3. Toca el botón **Compartir** (cuadrado con flecha)
4. Selecciona **"Agregar a inicio"**
5. La app se instalará como una app nativa

### Android

1. Abre Chrome en tu dispositivo
2. Ve a `https://tu-app.vercel.app`
3. Toca los **tres puntos** (menú)
4. Selecciona **"Instalar aplicación"** o **"Agregar a pantalla de inicio"**
5. La app se instalará como una app nativa

---

## Solución de Problemas

### Error: "Sesión expirada o no autenticada"

- Verifica que `SESSION_SECRET` esté configurado en Render
- Revisa que las cookies no estén bloqueadas en el navegador

### Error: "No se pudo conectar a la base de datos"

- Verifica que `DATABASE_URL` y `DIRECT_URL` sean correctas
- En Supabase, ve a **Settings > Database** y habilita **Connection Pooler**
- Asegúrate de que Render tenga acceso a Supabase (IPs permitidas)

### Error: "Fallo al subir evidencia"

- Verifica que el bucket `evidencias` exista en Supabase Storage
- Revisa que las políticas de seguridad estén configuradas
- Confirma que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` sean correctas

### Cold Start en Render (primer request tarda)

- Los servicios gratuitos en Render entran en suspensión después de 15 min de inactividad
- El primer request después de este período tarda ~30-50 segundos
- Solución: Actualizar a plan **Standard** o usar un servicio de uptime monitoring

---

## Comandos Útiles

### Local Development

```bash
# Instalar dependencias
npm install

# Correr en desarrollo
npm run dev

# Aplicar schema a DB local
npm run db:push

# Build de producción
npm run build

# Preview del build
npm run preview
```

### Database

```bash
# Generar Prisma Client
npx prisma generate

# Ver migraciones
npx prisma migrate dev

# Ver datos en DB
npx prisma studio
```

---

## Estructura de Archivos

```
Incubant/
├── api/                    # Backend para Vercel (serverless)
├── backend/                # Lógica compartida del backend
├── prisma/
│   └── schema.prisma       # Schema de la base de datos
├── src/                    # Frontend React
│   ├── components/
│   ├── screens/
│   ├── store/
│   └── utils/
├── supabase/
│   ├── migrations/         # Scripts SQL para Supabase
│   └── storage-setup.sql   # Configuración de Storage
├── .env                    # Variables de entorno (NO commitear)
├── .env.example            # Ejemplo de variables
├── vercel.json             # Configuración Vercel
├── render.yaml             # Configuración Render
└── DEPLOYMENT.md           # Esta guía
```

---

## Soporte

Para problemas o preguntas, revisa los logs en:
- **Vercel**: Dashboard > Project > Deployments > View Logs
- **Render**: Dashboard > Web Service > Logs
- **Supabase**: Dashboard > Logs
