# Incubant Monitor

**Sistema de Gestión y Monitoreo para Plantas de Incubación**

Panel operativo y administrativo para el monitoreo de incubadoras y nacedoras - Antioqueña de Incubación S.A.S.

![Versión](https://img.shields.io/badge/versión-0.1.0-blue)
![React](https://img.shields.io/badge/React-19-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6)
![Vite](https://img.shields.io/badge/Vite-6-646cff)

---

## Características

- **Multiplataforma**: Web app progresiva (PWA) compatible con iOS y Android
- **Roles de usuario**: Operario, Supervisor y Jefe
- **Monitoreo en tiempo real**: Parámetros de incubadoras y nacedoras
- **Captura de evidencias**: Fotos subidas a Supabase Storage
- **Panel supervisor**: Dashboard administrativo con métricas
- **Gestión de turnos**: Asignación y recordatorios automáticos
- **Incidentes y alarmas**: Registro y seguimiento de eventos

---

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Frontend** | React 19 + Vite + TypeScript |
| **Estilos** | Tailwind CSS 4 + Motion |
| **Estado** | Zustand |
| **Backend** | Express (Node.js) |
| **Base de datos** | PostgreSQL (Supabase) |
| **ORM** | Prisma |
| **Storage** | Supabase Storage |
| **Deploy** | Vercel (frontend) + Render (backend) |

---

## Inicio Rápido

### 1. Clonar el repositorio

```bash
git clone https://github.com/HenryStark866/Incubant.git
cd Incubant
```

### 2. Configurar entorno

Ejecuta el script de configuración:

**Windows:**
```bash
setup.bat
```

**Linux/Mac:**
```bash
chmod +x setup.sh && ./setup.sh
```

O manualmente:

```bash
# Copiar archivo de entorno
cp .env.example .env

# Instalar dependencias
npm install

# Generar Prisma Client
npx prisma generate
```

### 3. Configurar variables de entorno

Edita `.env` con tus credenciales de Supabase:

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
SESSION_SECRET=tu-secreto-seguro-min-32-caracteres
VITE_SUPABASE_URL=https://[REF].supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

### 4. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ejecuta `supabase/migrations/001_init_schema.sql` en el SQL Editor
3. Crea un bucket `evidencias` en Storage (público)
4. Ejecuta `supabase/storage-setup.sql` para políticas

### 5. Iniciar desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## Credenciales de Prueba

| Usuario | PIN | Rol | Turno |
|---------|-----|-----|-------|
| `admin` | `4753` | JEFE | Gestión |
| `elkin-cavadia` | `11168` | JEFE | Gestión |
| `jhon-piedrahita` | `jp2026` | SUPERVISOR | Turno 1 |
| `juan-alejandro` | `1111` | OPERARIO | Turno 3 |
| `juan-suaza` | `2222` | OPERARIO | Turno 1 |
| `ferney-tabares` | `3333` | OPERARIO | Turno 2 |
| `luis-cortes` | `4444` | OPERARIO | Turno 2 |

---

## Comandos Disponibles

```bash
npm run dev          # Iniciar servidor de desarrollo
npm run build        # Build de producción
npm run preview      # Preview del build
npm run db:push      # Aplicar schema a la DB
npx prisma studio    # Ver datos en la DB
npx prisma generate  # Regenerar Prisma Client
```

---

## Despliegue en Producción

Para desplegar en Vercel + Render + Supabase, sigue la guía completa:

📖 Ver [DEPLOYMENT.md](./DEPLOYMENT.md)

### Resumen del despliegue

1. **Supabase**: Base de datos PostgreSQL + Storage
2. **Render**: Backend API (Express)
3. **Vercel**: Frontend (React + Vite)

---

## Estructura del Proyecto

```
Incubant/
├── api/                    # Backend serverless (Vercel)
├── backend/                # Lógica compartida del backend
│   └── createApiApp.ts     # API Express principal
├── prisma/
│   └── schema.prisma       # Schema de base de datos
├── src/
│   ├── components/         # Componentes React reutilizables
│   ├── screens/            # Pantallas principales
│   │   ├── LoginScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── CameraScreen.tsx
│   │   ├── FormScreen.tsx
│   │   └── SupervisorDashboard.tsx
│   ├── hooks/              # Hooks personalizados
│   ├── lib/                # Utilidades y configuración
│   ├── store/              # Estado global (Zustand)
│   └── utils/              # Funciones auxiliares
├── supabase/
│   ├── migrations/         # Scripts SQL
│   └── storage-setup.sql   # Configuración Storage
├── public/                 # Assets estáticos
├── .env                    # Variables de entorno
├── .env.example            # Ejemplo de variables
├── vercel.json             # Configuración Vercel
├── render.yaml             # Configuración Render
├── vite.config.ts          # Configuración Vite
└── package.json
```

---

## Instalación en Dispositivos Móviles

### iOS (iPhone/iPad)

1. Abre Safari y ve a la app desplegada
2. Toca **Compartir** → **"Agregar a inicio"**
3. La app se instala como nativa

### Android

1. Abre Chrome y ve a la app desplegada
2. Toca **menú** → **"Instalar aplicación"**
3. La app se instala como nativa

---

## Capturas de Pantalla

_(Agregar capturas del dashboard, login y panel supervisor)_

---

## Licencia

© 2026 Antioqueña de Incubación S.A.S.

---

## Soporte

Para problemas o preguntas, consulta:
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Guía de despliegue
- Logs de Vercel/Render para errores en producción
- `npx prisma studio` para verificar datos en la DB
