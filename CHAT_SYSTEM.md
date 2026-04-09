# Sistema de Chat Interno - Incubant

**Fecha:** 2025-01-01  
**Estado:** ✅ Implementado  
**Autor:** HenryStark866  

## Descripción General

Sistema de mensajería interna integrado en Incubant que permite:
- Comunicación 1:1 entre operarios
- Chats grupales por tipo (GENERAL, REPORTES, TURNO, PRIVADO)
- Historial completamente auditado en PostgreSQL
- Real-time notifications vía SSE
- Acceso desde el panel de historial/comunicaciones

## Componentes Implementados

### 1. Backend - Controladores (`backend/controllers/chat.controller.ts`)

```typescript
// Crear nueva conversación
POST /api/chat/conversations
Body: {
  tipo: 'PRIVADO' | 'REPORTES' | 'GENERAL' | 'TURNO',
  titulo?: string,
  participant_ids: string[]
}

// Obtener conversaciones del usuario actual
GET /api/chat/conversations

// Obtener mensajes paginados
GET /api/chat/conversations/:id/messages?limit=100&offset=0

// Enviar nuevo mensaje
POST /api/chat/messages
Body: {
  conversation_id: string,
  contenido: string
}

// Eliminar mensaje (solo sender)
DELETE /api/chat/messages/:id

// Historial completo (SupervisorrJefe)
GET /api/chat/history
```

### 2. Base de Datos - Prisma Models

```prisma
// Tablas creadas:
enum ConversationType {
  PRIVADO
  REPORTES
  GENERAL
  TURNO
}

model Conversation {
  id                    String
  titulo                String?
  tipo                  ConversationType
  participants          ConversationParticipant[]
  messages              Message[]
  createdAt             DateTime
  updatedAt             DateTime
}

model ConversationParticipant {
  id                    String
  conversation_id       String
  user_id               String
  joinedAt              DateTime
  
  // Relaciones
  conversation          Conversation
  user                  User
}

model Message {
  id                    String
  conversation_id       String
  sender_id             String
  contenido             String
  editedAt              DateTime?
  createdAt             DateTime
  updatedAt             DateTime
  
  // Relaciones
  conversation          Conversation
  sender                User
}
```

### 3. Frontend - React Component

**Ubicación:** `src/components/ChatPanel.tsx`

Características:
- Lista de conversaciones con búsqueda
- Panel de mensajes con scroll automático
- Input para enviar mensajes
- Timestamps en cada mensaje
- Auto-refresh cada 3-5 segundos
- Identifica remitentes en mensajes grupales

## Instalación y Activación

### Paso 1: Ejecutar Migración SQL

```bash
# Opción A: Automático en Render/Vercel
# Las migraciones se ejecutan al hacer deploy

# Opción B: Manual en Supabase (para desarrollo)
npm run setup:chat-migration
```

Esto abrirá instrucciones para copiar-pegar SQL en Supabase Dashboard.

### Paso 2: Build y Deploy

```bash
cd /path/to/Incubant

# Build con Prisma migrate
npm run build

# Commit y push con autor correcto
git config user.email "henrystark866@incubant.co"
git config user.name "HenryStark866"
git add .
git commit -m "feat: Implement internal chat system with persistence"
git push origin main

# Render/Vercel auto-deploya
```

## Flujo de la Aplicación

```
1. Usuario abre ChatPanel desde navegación lateral
   ↓
2. Carga conversaciones: GET /api/chat/conversations
   ↓
3. Selecciona conversación
   ↓
4. Carga mensajes: GET /api/chat/conversations/:id/messages
   ↓
5. Redacta mensaje y presiona SEND
   ↓
6. POST /api/chat/messages con contenido
   ↓
7. Backend guarda en PostgreSQL (Supabase)
   ↓
8. Emite evento SSE (NEW_MESSAGE)
   ↓
9. Frontend recibe notificación y recarga (auto-refresh)
   ↓
10. Mensaje aparece en chat
```

## Roles y Permisos

| Rol | Permisos |
|-----|----------|
| OPERARIO | Enviar mensajes en chats asignados, ver su conversación |
| SUPERVISOR | + Ver historial de reportes, crear chats dirigidos |
| JEFE | + Auditar todos los chats, exportar historial |

## Configuración en Render/Vercel

### Render (Backend)

```bash
# Automático al push a main:
npm run build     # Ejecuta prisma migrate dev
npm run start     # Inicia servidor con chat endpoints
```

### Vercel (Frontend)

```bash
# Automático al push a main:
npm run build     # Vite + TypeScript
# Deploy automático
```

## Prueba Local

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
npm run dev

# Abre http://localhost:5173
# Click en ícono de Chat en nav
# Crea conversación o selecciona existente
```

## Características Futuras

- [ ] Edición de mensajes
- [ ] Reacciones emoji
- [ ] Adjuntos de archivos
- [ ] Búsqueda en conversaciones
- [ ] Notificaciones push
- [ ] Mute de conversaciones
- [ ] Exportación de chat a PDF

## Troubleshooting

### "Cannot find module 'chat.controller'"
→ Ejecuta `npx tsc --noEmit` en backend/  
→ Verifica que el archivo existe en `backend/controllers/chat.controller.ts`

### "Tables don't exist"
→ Ejecuta la migración SQL en Supabase Dashboard  
→ Verifica con `SELECT * FROM "Conversation";`

### Messages no se sincronizan
→ Verifica conectividad a PostgreSQL  
→ Revisa logs del backend en Render

### CORS errors
→ Backend debe estar en CORS whitelist  
→ Revisa variable `FRONTEND_URL` en .env

## Commits Relacionados

- **`<hash>`** - "feat: Implement internal chat system with persistence"
  - Prisma models añadidos
  - Backend controllers implementados
  - API endpoints registrados
  - Frontend ChatPanel component
  - SQL migration file

## Notas de Desarrollo

- SSE para real-time (follow pattern from photos)
- Paginación de mensajes por límite/offset
- Índices en PostgreSQL para queries rápidas
- Enum type para tipos de conversación
- Soft-delete no implementado (CASCADE delete)
