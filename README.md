# Incubant Monitor  

Panel operativo y panel administrativo para monitoreo de incubadoras y nacedoras.

## Estado actual

- Login con sesion HTTP segura para operarios, supervisores y jefes.
- Panel supervisor protegido por rol; ya no se abre sin autenticacion valida.
- Dashboard web con contador de reportes real; si la base no responde, muestra `0` y listas vacias en vez de datos demo.
- API preparada para desarrollo local con `Express` y para despliegue en Vercel con `api/[...path].ts`.
- Carga de evidencias a Supabase con fallback seguro si faltan credenciales o el upload falla.

## Stack

- `React 19` + `Vite`
- `Express`
- `Prisma`
- `Supabase Storage`
- `Tailwind CSS`
- `Zustand`

## Variables de entorno

Crea un archivo `.env` local a partir de `.env.example`.

Variables usadas por el proyecto:

- `DATABASE_URL`: conexion PostgreSQL para Prisma.
- `SESSION_SECRET`: firma de cookies de sesion del backend.
- `VITE_SUPABASE_URL`: URL del proyecto de Supabase.
- `VITE_SUPABASE_ANON_KEY`: llave publica anon para Storage.
- `GEMINI_API_KEY`: opcional; solo se conserva por compatibilidad de build.

## Desarrollo local

1. Instala dependencias con `npm install`.
2. Crea `.env` con tus credenciales.
3. Ejecuta `npm run dev`.
4. Abre `http://localhost:3000`.

Comandos utiles:

- `npm run lint`
- `npm run build`
- `npm run preview`

## Despliegue en Vercel

La app esta configurada para:

- servir el frontend desde `dist`
- enrutar `/api/*` al backend serverless en `api/[...path].ts`
- enrutar el resto del trafico a `index.html`

Antes de desplegar en Vercel:

1. Configura las variables `DATABASE_URL`, `SESSION_SECRET`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
2. Verifica que el commit se publique con un correo asociado a la cuenta de GitHub para evitar bloqueos de deploy.
3. Confirma que la base de datos responda desde el entorno de despliegue.

## Notas de base de datos

- Si PostgreSQL no esta disponible, el sistema mantiene el login de respaldo y evita mostrar datos falsos en el dashboard.
- El dashboard supervisor usa conteo real de `HourlyLog`; si no hay conectividad, responde `0`.
- La sincronizacion de revisiones intenta resolver usuarios y maquinas antes de insertar logs en la base.

## Estructura principal

- `src/`: frontend React.
- `backend/createApiApp.ts`: API compartida entre local y Vercel.
- `api/[...path].ts`: entrada serverless para Vercel.
- `server.ts`: servidor local con Vite middleware.
- `prisma/schema.prisma`: modelos de base de datos.

## Verificacion recomendada

- `npm run lint`
- `npm run build`
- login con usuario de prueba
- acceso a panel supervisor solo con `JEFE` o `SUPERVISOR`
- sincronizacion de una revision operativa
