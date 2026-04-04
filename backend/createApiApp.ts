// Manual Redeploy for CORS sync by HenryStark866
import crypto from 'crypto';
import cron from 'node-cron';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import type { PrismaClient } from '@prisma/client';

import { processMachineReport, requestClosingReport, getHistory } from './controllers/report.controller';
import { seedShifts } from './controllers/admin.controller';
import { uploadToSupabase } from './services/supabase_storage.service';

type UserRole = 'OPERARIO' | 'SUPERVISOR' | 'JEFE';

type SessionUser = {
  id: string;
  name: string;
  role: UserRole;
  shift?: string;
  shiftColor?: string;
  shiftStart?: string;
  shiftEnd?: string;
};

type AuthenticatedRequest = Request & {
  user?: SessionUser;
};

type SubmittedMachineData = {
  tiempoIncubacion?: {
    dias: string;
    horas: string;
    minutos: string;
  };
  // Legacy / simplified names (kept for backwards compat)
  tempOvoscan?: string;
  tempAire?: string;
  temperatura?: string;
  humedadRelativa?: string;
  co2?: string;
  // Full Real/SP names (what the frontend store actually sends)
  tempOvoscanReal?: string;
  tempOvoscanSP?: string;
  tempAireReal?: string;
  tempAireSP?: string;
  tempSynchroReal?: string;
  tempSynchroSP?: string;
  temperaturaReal?: string;
  temperaturaSP?: string;
  humedadReal?: string;
  humedadSP?: string;
  co2Real?: string;
  co2SP?: string;
  // Common fields
  volteoNumero?: string;
  volteoPosicion?: string;
  alarma?: 'Si' | 'No';
  observaciones?: string;
  ventiladorPrincipal?: 'Si' | 'No';
};

type SubmittedMachine = {
  id: string;
  type?: 'incubadora' | 'nacedora';
  number?: number;
  status: string;
  photoUrl?: string | null;
  data?: SubmittedMachineData;
};

const SESSION_COOKIE_NAME = 'incubant_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const SESSION_SECRET = process.env.SESSION_SECRET || 'incubantmonitor-dev-session-secret';
const SUPERVISOR_ROLES: UserRole[] = ['SUPERVISOR', 'JEFE'];

// ==========================================================================
// USUARIOS PREDEFINIDOS - ÚNICA FUENTE DE VERDAD PARA CREDENCIALES
// El campo `id` es un slug estable y URL-safe derivado del nombre de usuario.
// ==========================================================================
type PredefinedUser = {
  id: string;
  nombre: string;
  pin_acceso: string;
  rol: UserRole;
  turno: string;
};

const predefinedUsers: PredefinedUser[] = [
  { id: 'admin',          nombre: 'Administrador',  pin_acceso: '4753',   rol: 'JEFE',       turno: 'Gestión' },
  { id: 'elkin-cavadia',  nombre: 'Elkin Cavadia',  pin_acceso: '11168',  rol: 'JEFE',       turno: 'Gestión' },
  { id: 'juan-alejandro', nombre: 'Juan Alejandro', pin_acceso: '1111',   rol: 'OPERARIO',   turno: 'Turno 3' },
  { id: 'juan-suaza',     nombre: 'Juan Suaza',     pin_acceso: '2222',   rol: 'OPERARIO',   turno: 'Turno 1' },
  { id: 'ferney-tabares', nombre: 'Ferney Tabares', pin_acceso: '3333',   rol: 'OPERARIO',   turno: 'Turno 2' },
  { id: 'luis-cortes',        nombre: 'Luis Cortes',        pin_acceso: '4444',   rol: 'OPERARIO',   turno: 'Turno 2' },
  { id: 'jhon-piedrahita',nombre: 'Jhon Piedrahita',pin_acceso: 'jp2026', rol: 'SUPERVISOR', turno: 'Turno 1' },
];

// ==========================================================================
// PRISMA CLIENT
// ==========================================================================
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

async function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    const { PrismaClient } = await import('@prisma/client');
    // Sanitizar la URL: eliminar caracteres ocultos (\r) y espacios
    const dbUrl = (process.env.DATABASE_URL || '').replace(/\r/g, '').trim();
    
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    });
  }

  return globalForPrisma.prisma;
}

// ==========================================================================
// SSE - REAL TIME EVENTS
// ==========================================================================
let clients: Response[] = [];

function sendEventToAll(data: any) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(c => c.write(payload));
}

function sendEventToUser(userId: string, data: any) {
  // En un sistema real usaríamos un Map para eficiencia. 
  // Para esta escala, filtramos o enviamos a todos con el ID del destinatario.
  const payload = `data: ${JSON.stringify({ ...data, targetUserId: userId })}\n\n`;
  clients.forEach(c => c.write(payload));
}

// ==========================================================================
// SESSION HELPERS (Database Backed)
// ==========================================================================
async function getCurrentShiftForUser(userId: string): Promise<string> {
  try {
    const prisma = await getPrismaClient();
    const today = getTodayInBogota();

    const assignment = await prisma.scheduleAssignment.findFirst({
      where: {
        user_id: userId,
        fecha: today
      },
      include: { shift: true }
    });

    if (assignment?.shift) {
      return `${assignment.shift.nombre} (${assignment.shift.hora_inicio} - ${assignment.shift.hora_fin})`;
    }
  } catch (error) {
    console.warn('[Shift] Error querying assignment:', error);
  }
  
  // Fallback to static user turno if no assignment or DB error
  try {
    const prisma = await getPrismaClient();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    // Obtener hora actual en Colombia para el fallback sintético
    const nowBogota = new Date(Date.now() - 5 * 60 * 60 * 1000);
    return user?.turno || getShiftName(nowBogota);
  } catch {
    const nowBogota = new Date(Date.now() - 5 * 60 * 60 * 1000);
    return getShiftName(nowBogota);
  }
}

async function getSession(token: string): Promise<SessionUser | null> {
  try {
    const prisma = await getPrismaClient();
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => null);
      return null;
    }

    const today = getTodayInBogota();
    const assignment = await prisma.scheduleAssignment.findFirst({
      where: { user_id: session.user.id, fecha: today },
      include: { shift: true }
    });

    return {
      id: session.user.id,
      name: session.user.nombre,
      role: session.user.rol as UserRole,
      shift: session.user.turno,
      shiftColor: assignment?.shift?.color || '#34d399',
      shiftStart: assignment?.shift?.hora_inicio || '06:00',
      shiftEnd: assignment?.shift?.hora_fin || '14:00',
    };
  } catch (error) {
    console.warn('[Session] Error querying DB:', error);
    return null;
  }
}

async function createSession(user_id: string, maxAge: number) {
  const prisma = await getPrismaClient();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + maxAge);
  
  await prisma.session.create({
    data: {
      token,
      user_id,
      expiresAt
    }
  });
  
  return token;
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((acc, cookiePart) => {
    const [rawName, ...rawValue] = cookiePart.trim().split('=');

    if (!rawName) {
      return acc;
    }

    acc[rawName] = decodeURIComponent(rawValue.join('='));
    return acc;
  }, {});
}

function buildSessionCookie(token: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  const secureFlag = isProduction ? '; Secure' : '';
  // SameSite=None;Secure is required for cookies to work across cross-origin requests
  // (Vercel frontend → Render backend via vercel.json rewrites).
  // In development, SameSite=Lax is fine since both run on localhost.
  const sameSite = isProduction ? 'None' : 'Lax';
  const maxAge = 12 * 60 * 60; // 12 horas
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAge}${secureFlag}`;
}

function clearSessionCookie() {
  const isProduction = process.env.NODE_ENV === 'production';
  const secureFlag = isProduction ? '; Secure' : '';
  const sameSite = isProduction ? 'None' : 'Lax';
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${secureFlag}`;
}

async function attachSessionUser(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];

  if (!token) {
    req.user = null as any;
    return next();
  }

  req.user = (await getSession(token)) as any;
  next();
}

function requireAuthenticatedUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Sesión expirada o no autenticada' });
  }

  next();
}

function requireRoles(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Sesión expirada o no autenticada' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permisos para acceder a este recurso' });
    }

    next();
  };
}

async function sendAuthenticatedUser(res: Response, user: { id: string, nombre: string, rol: string, turno: string }) {
  const maxAge = 12 * 60 * 60 * 1000;
  const token = await createSession(user.id, maxAge);
  res.setHeader('Set-Cookie', buildSessionCookie(token));
  
  const prisma = await getPrismaClient();
  const today = getTodayInBogota();
  const assignment = await prisma.scheduleAssignment.findFirst({
    where: { user_id: user.id, fecha: today },
    include: { shift: true }
  });

  return res.status(200).json({ 
    user: {
      id: user.id,
      name: user.nombre,
      role: user.rol,
      shift: user.turno,
      shiftColor: assignment?.shift?.color || '#34d399',
      shiftStart: assignment?.shift?.hora_inicio || '06:00',
      shiftEnd: assignment?.shift?.hora_fin || '14:00',
    }
  });
}

// ==========================================================================
// DATA HELPERS
// ==========================================================================
function toNumberOrNull(value?: string | number | null) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : null;
}

function parseLocalMachine(machine: SubmittedMachine): {
  type: 'incubadora' | 'nacedora';
  machineNumber: number;
  dbType: 'INCUBADORA' | 'NACEDORA';
} | null {
  const [prefix, numberPart] = String(machine.id || '').split('-');
  const type = machine.type || (prefix === 'inc' ? 'incubadora' : prefix === 'nac' ? 'nacedora' : undefined);
  const machineNumber = machine.number || Number(numberPart);

  if (!type || !Number.isFinite(machineNumber)) {
    return null;
  }

  return {
    type,
    machineNumber,
    dbType: type === 'incubadora' ? 'INCUBADORA' : 'NACEDORA',
  };
}

function buildObservationSummary(data: SubmittedMachineData) {
  const timeStr = data.tiempoIncubacion
    ? `Tiempo: ${data.tiempoIncubacion.dias}d ${data.tiempoIncubacion.horas}h ${data.tiempoIncubacion.minutos}m`
    : null;

  // Accept both legacy field names and Real-suffixed names from the frontend store
  const humedad = data.humedadReal || data.humedadRelativa;
  const co2Val = data.co2Real || data.co2;
  const tempAire = data.tempAireReal || data.tempAire || data.temperaturaReal;

  const details = [
    timeStr,
    humedad ? `Humedad: ${humedad}%` : null,
    co2Val ? `CO2: ${co2Val}%` : null,
    tempAire ? `Temp Aire: ${tempAire}` : null,
    data.volteoNumero ? `Volteos: ${data.volteoNumero}` : null,
    data.volteoPosicion ? `Posicion: ${data.volteoPosicion}` : null,
    data.alarma ? `Alarma: ${data.alarma}` : null,
    data.ventiladorPrincipal ? `Ventilador: ${data.ventiladorPrincipal}` : null,
    data.observaciones ? `Nota: ${data.observaciones}` : null,
  ].filter(Boolean);

  return details.join(' | ') || null;
}

function extractObservationValue(observaciones: string | null | undefined, label: string) {
  if (!observaciones) {
    return null;
  }

  const regex = new RegExp(`${label}:\\s*([^|]+)`);
  const match = observaciones.match(regex);
  return match?.[1]?.trim() || null;
}

// ==========================================================================
// DB RESOLUTION HELPERS
// Garantizan que los usuarios y máquinas existan en BD antes de insertar logs.
// ==========================================================================
async function resolveDatabaseUser(sessionUser: SessionUser) {
  const prisma = await getPrismaClient();

  // 1. Buscar primero por ID estable (slug)
  const byId = await prisma.user.findUnique({ where: { id: sessionUser.id } }).catch(() => null);
  if (byId) return byId;

  // 2. Buscar por nombre
  const byName = await prisma.user.findFirst({ where: { nombre: sessionUser.name } }).catch(() => null);
  if (byName) return byName;

  // 3. Crear el usuario en BD usando los datos del predefinido si existe, o datos sintéticos
  const predefined = predefinedUsers.find(u => u.id === sessionUser.id || u.nombre === sessionUser.name);

  return prisma.user.create({
    data: {
      id: sessionUser.id,
      nombre: sessionUser.name,
      pin_acceso: predefined?.pin_acceso || `ext-${crypto.createHash('sha1').update(sessionUser.id).digest('hex').slice(0, 8)}`,
      rol: sessionUser.role,
      turno: sessionUser.shift || predefined?.turno || 'Turno 1',
      estado: 'Activo',
      ultimo_acceso: new Date()
    },
  });
}

async function resolveDatabaseMachine(machine: SubmittedMachine) {
  const prisma = await getPrismaClient();
  const parsedMachine = parseLocalMachine(machine);

  if (!parsedMachine) {
    throw new Error(`Identificador de máquina inválido: ${machine.id}`);
  }

  const existingMachine = await prisma.machine.findFirst({
    where: {
      tipo: parsedMachine.dbType,
      numero_maquina: parsedMachine.machineNumber,
    },
  }).catch(() => null);

  if (existingMachine) {
    return existingMachine;
  }

  return prisma.machine.create({
    data: {
      tipo: parsedMachine.dbType,
      numero_maquina: parsedMachine.machineNumber,
    },
  });
}

// ==========================================================================
// SEED - Poblar la BD con los usuarios predefinidos
// ==========================================================================
async function seedPredefinedUsers() {
  try {
    const prisma = await getPrismaClient();
    for (const u of predefinedUsers) {
      try {
        await prisma.user.upsert({
          where: { id: u.id },
          update: {
            nombre: u.nombre,
            rol: u.rol,
            turno: u.turno,
          },
          create: {
            id: u.id,
            nombre: u.nombre,
            pin_acceso: u.pin_acceso,
            rol: u.rol,
            turno: u.turno,
            estado: 'Activo',
          },
        });
      } catch (userError) {
        console.warn(`[Seed] Saltando usuario '${u.nombre}' (ID o PIN duplicado).`);
      }
    }
    console.log(`[Seed] Sincronización de usuarios predefinidos finalizada.`);
  } catch (error) {
    console.warn('[Seed] No se pudo conectar a la base de datos para sembrar usuarios.', error instanceof Error ? error.message : '');
  }
}

// ==========================================================================
// SEED - 24 Incubadoras + 12 Nacedoras fijas en la DB
// ==========================================================================
async function seedMachines() {
  try {
    const prisma = await getPrismaClient();
    let created = 0;
    for (let i = 1; i <= 24; i++) {
      await prisma.machine.upsert({
        where: { id: `fixed-inc-${i}` }, // Using a stable ID or findFirst
        update: {},
        create: {
          id: `fixed-inc-${i}`,
          tipo: 'INCUBADORA',
          numero_maquina: i,
        },
      }).catch(async () => {
        // Fallback if ID strategy fails, use findFirst + create
        const exists = await prisma.machine.findFirst({ where: { tipo: 'INCUBADORA', numero_maquina: i } });
        if (!exists) await prisma.machine.create({ data: { tipo: 'INCUBADORA', numero_maquina: i } });
      });
      created++;
    }
    for (let i = 1; i <= 12; i++) {
      await prisma.machine.upsert({
        where: { id: `fixed-nac-${i}` },
        update: {},
        create: {
          id: `fixed-nac-${i}`,
          tipo: 'NACEDORA',
          numero_maquina: i,
        },
      }).catch(async () => {
        const exists = await prisma.machine.findFirst({ where: { tipo: 'NACEDORA', numero_maquina: i } });
        if (!exists) await prisma.machine.create({ data: { tipo: 'NACEDORA', numero_maquina: i } });
      });
      created++;
    }
    console.log(`[Seed] ${created} máquinas sembradas (24 INC + 12 NAC).`);
  } catch (error) {
    console.warn('[Seed] No se pudo sembrar máquinas:', error instanceof Error ? error.message : '');
  }
}

// ==========================================================================
// EXPRESS APP
// ==========================================================================
export function createApiApp(): Express {
  const app = express();

  const upload = multer({ storage: multer.memoryStorage() });

  app.use(express.json({ limit: '50mb' }));
  
  // CORS Configuration
  const allowedOrigins = [
    'https://incubantmonitor.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173'
  ];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }));

  app.use(attachSessionUser);

  // Intentar semillado al arrancar (no bloquea el arranque)
  void seedPredefinedUsers();
  void seedMachines();

  // ── Health Check ──────────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── Admin: Seed Operations ───────────────────────────────────────────────
  app.post('/api/admin/seed-shifts', seedShifts);

  // ── SSE Events Stream ────────────────────────────────────────────────────
  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Heartbeat para mantener conexión viva
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);

    const { addClient, removeClient } = require('./services/event.service');
    addClient(res);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeClient(res);
    });
  });

  // ── Smart Reporting (Gemini + Drive + PDF) ────────────────────────────────
  // NOTA: /api/reports/history se registra SOLO AQUÍ abajo (línea ~1847) con la implementación
  // inline. No duplicar rutas — Express solo ejecuta el primer match.
  app.post('/api/reports', requireAuthenticatedUser, upload.single('evidence'), processMachineReport);
  app.get('/api/reports/closing/request', requireAuthenticatedUser, requestClosingReport);

  // ── Session ──────────────────────────────────────────────────────────────
  app.get('/api/session', (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No hay sesión activa' });
    }

    return res.json({ user: req.user });
  });

  app.post('/api/logout', async (req: AuthenticatedRequest, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE_NAME];
    if (token) {
       const prisma = await getPrismaClient();
       await prisma.session.delete({ where: { token } }).catch(() => null);
    }
    res.setHeader('Set-Cookie', clearSessionCookie());
    res.status(204).end();
  });

  // ── Login ────────────────────────────────────────────────────────────────
  app.post('/api/login', async (req, res) => {
    const { id, pin } = req.body ?? {};

    if (!id || !pin) {
      return res.status(400).json({ error: 'Credenciales incompletas' });
    }

    // 1. Intentar autenticación desde la BD
    try {
      const prisma = await getPrismaClient();
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { id: String(id) },
            { nombre: { equals: String(id), mode: 'insensitive' } },
          ],
        },
      });

      if (user && user.pin_acceso === String(pin) && ['OPERARIO', 'SUPERVISOR', 'JEFE'].includes(user.rol)) {
        console.log(`[Login] Autenticado desde BD: ${user.nombre}`);
        await prisma.user.update({
          where: { id: user.id },
          data: { ultimo_acceso: new Date() }
        });
        return sendAuthenticatedUser(res, {
          id: user.id,
          nombre: user.nombre,
          rol: user.rol,
          turno: user.turno,
        });
      }
    } catch (error) {
      console.warn('[Login] Error de BD, usando fallback local:', error instanceof Error ? error.message : error);
    }

    // 2. Fallback: credenciales predefinidas locales (buscar por id slug, nombre o pin)
    const localUser = predefinedUsers.find(u =>
      (u.id === String(id) || u.nombre.toLowerCase() === String(id).toLowerCase()) &&
      u.pin_acceso === String(pin)
    );

    if (localUser) {
      console.log(`[Login] Autenticado con credencial local (fallback): ${localUser.nombre}`);
      // Intentar registrar en BD para que esté disponible en sincronizaciones
      try {
        const prisma = await getPrismaClient();
        await prisma.user.upsert({
          where: { id: localUser.id },
          update: { nombre: localUser.nombre, rol: localUser.rol, turno: localUser.turno },
          create: {
            id: localUser.id,
            nombre: localUser.nombre,
            pin_acceso: localUser.pin_acceso,
            rol: localUser.rol,
            turno: localUser.turno,
            estado: 'Activo',
          },
        });
      } catch {
        // No crítico
      }

      return sendAuthenticatedUser(res, {
        id: localUser.id,
        nombre: localUser.nombre,
        rol: localUser.rol,
        turno: localUser.turno,
      });
    }

    return res.status(401).json({ error: 'PIN o usuario incorrectos' });
  });

  // ── Sync Hourly ──────────────────────────────────────────────────────────
  app.post('/api/sync-hourly', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const { machines } = req.body as { machines?: SubmittedMachine[] };

      if (!machines || !Array.isArray(machines)) {
        return res.status(400).json({ error: 'Datos inválidos o incompletos' });
      }

      const completedMachines = machines.filter((machine) => machine.status === 'completed' && machine.data);

      if (completedMachines.length === 0) {
        return res.status(400).json({ error: 'No hay máquinas completadas para sincronizar' });
      }

      try {
        const prisma = await getPrismaClient();
        const databaseUser = await resolveDatabaseUser(req.user!);

        const logsToInsert = await Promise.all(completedMachines.map(async (machine) => {
          const resolvedMachine = await resolveDatabaseMachine(machine);
          
          // Para máquinas apagadas, usar 0
          const d = machine.data!;
          // Accept both Real-suffixed and legacy field names
          const mainTemp = toNumberOrNull(d.tempOvoscanReal) ?? toNumberOrNull(d.tempSynchroReal) ?? toNumberOrNull(d.tempOvoscan) ?? toNumberOrNull(d.temperatura) ?? 0;
          const mainTempSP = toNumberOrNull(d.tempOvoscanSP) ?? toNumberOrNull(d.tempSynchroSP) ?? mainTemp;
          const secondaryTemp = toNumberOrNull(d.tempAireReal) ?? toNumberOrNull(d.temperaturaReal) ?? toNumberOrNull(d.tempAire) ?? mainTemp;
          const secondaryTempSP = toNumberOrNull(d.tempAireSP) ?? toNumberOrNull(d.temperaturaSP) ?? mainTemp;
          const co2 = toNumberOrNull(d.co2Real) ?? toNumberOrNull(d.co2) ?? 0;
          const co2SP = toNumberOrNull(d.co2SP) ?? co2;

          // Crear incidente automático si hay alarma
          if (d.alarma === 'Si') {
            await prisma.incident.create({
              data: {
                user_id: databaseUser.id,
                machine_id: resolvedMachine.id,
                titulo: `Alarma en ${machine.id}`,
                descripcion: d.observaciones || 'Alarma detectada en reporte horario',
                tipo: 'ALARM'
              }
            });
          }

          const humedad = toNumberOrNull(d.humedadReal) ?? toNumberOrNull(d.humedadRelativa) ?? 0;
          const humedadSP = toNumberOrNull(d.humedadSP) ?? humedad;

          return {
            user_id: databaseUser.id,
            machine_id: resolvedMachine.id,
            photo_url: machine.photoUrl || null,
            temp_principal_actual: mainTemp,
            temp_principal_consigna: mainTempSP,
            co2_actual: co2,
            co2_consigna: co2SP,
            humedad_actual: humedad,
            humedad_consigna: humedadSP,
            temp_secundaria_actual: secondaryTemp,
            temp_secundaria_consigna: secondaryTempSP,
            is_na: machine.type === 'nacedora',
            temp_superior_actual: null,
            observaciones: buildObservationSummary(d),
          };
        }));

        const result = await prisma.hourlyLog.createMany({
          data: logsToInsert,
        });

        sendEventToAll({ type: 'NEW_REPORT', message: 'Nuevo reporte sincronizado', timestamp: new Date().toISOString() });

        return res.status(200).json({
          message: 'Sincronización exitosa',
          count: result.count,
        });
      } catch (dbError) {
        console.error('[Sync] Error al sincronizar con la base de datos:', dbError);
        // Respondemos 200 para que el frontend no bloquee al operario, pero indicamos el error de BD
        return res.status(500).json({ error: 'No se pudo conectar a la base de datos para guardar los registros. Los datos locales están intactos.' });
      }
    } catch (error) {
      console.error('[Sync] Error interno:', error);
      return res.status(500).json({ error: 'Error interno del servidor al sincronizar' });
    }
  });

  // ── Sync Hourly with Storage Upload ─────────────────────────────────────
  // Recibe fotos en base64 + datos, sube a Supabase Storage
  app.post('/api/sync-hourly-drive', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const { machines, novelty } = req.body as { machines?: SubmittedMachine[], novelty?: { hasNovelty: boolean, text: string } };
      const userName = req.user?.name || 'Operario';

      console.log(`[Sync Storage] Recibido: ${machines?.length || 0} máquinas, usuario: ${userName}`);

      if (!machines || !Array.isArray(machines)) {
        return res.status(400).json({ error: 'Datos inválidos o incompletos' });
      }

      const completedMachines = machines.filter((machine) => machine.status === 'completed' && machine.data);

      if (completedMachines.length === 0) {
        return res.status(400).json({ error: 'No hay máquinas completadas para sincronizar' });
      }

      const storageResults: { machineId: string; photoUrl?: string; photoError?: string }[] = [];

      // Subir cada foto a Storage
      for (const machine of completedMachines) {
        const result: { machineId: string; photoUrl?: string; photoError?: string } = { machineId: machine.id };

        const photoStr = machine.photoUrl;
        if (photoStr && photoStr.length > 100 && photoStr.startsWith('data:image')) {
          try {
            const base64Data = photoStr.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            const uploadResult = await uploadToSupabase(
              buffer, userName, 'photos', 'image/jpeg', machine.id
            );
            result.photoUrl = uploadResult.publicUrl;
            console.log(`[Storage Sync] ✅ Foto subida OK: ${uploadResult.fileName} (${machine.id}) -> ${uploadResult.publicUrl}`);
          } catch (err) {
            result.photoError = err instanceof Error ? err.message : 'Error desconocido';
            console.error(`[Storage Sync] ❌ Error subiendo foto ${machine.id}:`, err);
          }
        } else if (photoStr && photoStr.length > 100 && !photoStr.startsWith('data:')) {
          result.photoUrl = photoStr;
        }

        storageResults.push(result);
      }

      // Guardar en BD
      try {
        const prisma = await getPrismaClient();
        const databaseUser = await resolveDatabaseUser(req.user!);

        const logsToInsert = await Promise.all(completedMachines.map(async (machine) => {
          const resolvedMachine = await resolveDatabaseMachine(machine);
          const d = machine.data!;

          // Extract temperatures: accept both Real-suffixed and legacy field names
          const mainTemp = toNumberOrNull(d.tempOvoscanReal) ?? toNumberOrNull(d.tempSynchroReal) ?? toNumberOrNull(d.tempOvoscan) ?? toNumberOrNull(d.temperatura) ?? 0;
          const mainTempSP = toNumberOrNull(d.tempOvoscanSP) ?? toNumberOrNull(d.tempSynchroSP) ?? mainTemp;
          const secondaryTemp = toNumberOrNull(d.tempAireReal) ?? toNumberOrNull(d.temperaturaReal) ?? toNumberOrNull(d.tempAire) ?? mainTemp;
          const secondaryTempSP = toNumberOrNull(d.tempAireSP) ?? toNumberOrNull(d.temperaturaSP) ?? mainTemp;
          const co2 = toNumberOrNull(d.co2Real) ?? toNumberOrNull(d.co2) ?? 0;
          const co2SP = toNumberOrNull(d.co2SP) ?? co2;
          const humedad = toNumberOrNull(d.humedadReal) ?? toNumberOrNull(d.humedadRelativa) ?? 0;

          const storageResult = storageResults.find(r => r.machineId === machine.id);
          const humedadDrive = humedad;
          const humedadDriveSP = toNumberOrNull(d.humedadSP) ?? humedadDrive;

          if (d.alarma === 'Si') {
            await prisma.incident.create({
              data: {
                user_id: databaseUser.id,
                machine_id: resolvedMachine.id,
                titulo: `Alarma en ${machine.id}`,
                descripcion: d.observaciones || 'Alarma detectada en reporte horario',
                tipo: 'ALARM'
              }
            });
          }

          return {
            user_id: databaseUser.id,
            machine_id: resolvedMachine.id,
            photo_url: storageResult?.photoUrl || null,
            temp_principal_actual: mainTemp,
            temp_principal_consigna: mainTempSP,
            co2_actual: co2,
            co2_consigna: co2SP,
            humedad_actual: humedadDrive,
            humedad_consigna: humedadDriveSP,
            temp_secundaria_actual: secondaryTemp,
            temp_secundaria_consigna: secondaryTempSP,
            is_na: machine.type === 'nacedora',
            temp_superior_actual: null,
            observaciones: buildObservationSummary(d),
          };
        }));

        await prisma.hourlyLog.createMany({ data: logsToInsert });

        // Guardar "minuta" o novedad
        if (novelty) {
          await prisma.incident.create({
            data: {
              user_id: databaseUser.id,
              titulo: novelty.hasNovelty ? 'Novedad Reportada (Minuta)' : 'Reporte Sin Novedades (Minuta)',
              descripcion: novelty.text,
              tipo: novelty.hasNovelty ? 'NOVELTY' : 'MINUTA',
            }
          });
        }

        // ── Generar PDF de Informe Horario (Sincronización) ──
        try {
          const { generateSummaryPDF } = await import('./services/pdf.service');
          const { uploadToSupabase } = await import('./services/supabase_storage.service');
          
          // Obtener los logs recién creados para el PDF (con relaciones)
          const logsForPdf = await prisma.hourlyLog.findMany({
            where: {
              user_id: databaseUser.id,
              fecha_hora: { gte: new Date(Date.now() - 5 * 60 * 1000) } // Logs de los últimos 5 min
            },
            include: { machine: true, user: true },
            orderBy: { fecha_hora: 'desc' }
          });

          if (logsForPdf.length > 0) {
            const pdfBuffer = await generateSummaryPDF(userName, (req.user as any)?.shift || 'Turno Actual', logsForPdf);
            const pdfResult = await uploadToSupabase(pdfBuffer, userName, 'reports', 'application/pdf');
            console.log(`[Sync Storage] ✅ PDF Horario generado y subido: ${pdfResult.publicUrl}`);
            
            // También lo guardamos en la tabla Report para el historial administrativo
            await prisma.report.create({
              data: {
                user_id: databaseUser.id,
                machine_id: logsForPdf[0].machine_id,
                pdfUrl: pdfResult.publicUrl,
                isClosingReport: false,
                observaciones: `Reporte sincronizado manualmente - ${logsForPdf.length} máquinas.`,
              }
            });
          }
        } catch (pdfErr) {
          console.error('[Sync Storage] Error generando PDF horario:', pdfErr);
        }

        sendEventToAll({ type: 'NEW_REPORT', message: 'Nuevo reporte sincronizado', timestamp: new Date().toISOString() });
      } catch (dbError) {
        console.error('[Sync Storage] Error BD:', dbError);
      }

      return res.status(200).json({
        message: 'Sincronización con Storage exitosa',
        storageResults,
      });
    } catch (error) {
      console.error('[Sync Storage] Error interno:', error);
      return res.status(500).json({ error: 'Error interno del servidor al sincronizar con Storage' });
    }
  });


  // ── Seed April 1-15 Schedule ─────────────────────────────────────────────
  app.post('/api/admin/seed-april-schedule', requireRoles(['JEFE', 'SUPERVISOR']), async (_req, res) => {
    try {
      const prisma = await getPrismaClient();

      // 1. Ensure all operators exist
      const operators = [
        { nombre: 'Luis Cortés', pin: '1001', rol: 'OPERARIO', turno: 'Turno Mañana' },
        { nombre: 'Juan Suaza', pin: '1002', rol: 'OPERARIO', turno: 'Turno Tarde' },
        { nombre: 'Juan Alejandro', pin: '1003', rol: 'OPERARIO', turno: 'Turno Tarde' },
        { nombre: 'Ferney', pin: '1004', rol: 'OPERARIO', turno: 'Turno Noche' },
        { nombre: 'Kierson', pin: '1005', rol: 'OPERARIO', turno: 'Turno Noche' },
        { nombre: 'Manuel', pin: '1006', rol: 'OPERARIO', turno: 'Turno Mañana' },
        { nombre: 'Jerrson', pin: '1007', rol: 'OPERARIO', turno: 'Turno Mañana' },
      ];

      const createdUsers: Record<string, any> = {};
      for (const op of operators) {
        const slugId = op.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
        const user = await prisma.user.upsert({
          where: { id: slugId },
          update: { nombre: op.nombre, pin_acceso: op.pin, rol: op.rol as any, turno: op.turno },
          create: { id: slugId, nombre: op.nombre, pin_acceso: op.pin, rol: op.rol as any, turno: op.turno, estado: 'Activo' },
        });
        createdUsers[op.nombre] = user;
      }

      // 2. Ensure shifts exist
      const shiftDefs = [
        { nombre: 'Turno Mañana (6-14:40)', hora_inicio: '06:00', hora_fin: '14:40', color: '#f59e0b' },
        { nombre: 'Turno Tarde (14-22)', hora_inicio: '14:00', hora_fin: '22:00', color: '#3b82f6' },
        { nombre: 'Turno Tarde (14:40-22:20)', hora_inicio: '14:40', hora_fin: '22:20', color: '#6366f1' },
        { nombre: 'Turno Noche (22:20-06:00)', hora_inicio: '22:20', hora_fin: '06:00', color: '#8b5cf6' },
        { nombre: 'Turno Noche (22-06)', hora_inicio: '22:00', hora_fin: '06:00', color: '#a855f7' },
      ];

      const createdShifts: Record<string, any> = {};
      for (const s of shiftDefs) {
        const shift = await prisma.shift.upsert({
          where: { nombre: s.nombre },
          update: s,
          create: s,
        });
        createdShifts[s.nombre] = shift;
      }

      // 3. Schedule: April 1-15, 2026
      // Shift mapping per operator:
      // Luis Cortés:     6:00 - 14:40  (Turno Mañana 6-14:40)
      // Juan Suaza:      14:00 - 22:00 (Turno Tarde 14-22)
      // Juan Alejandro:  14:40 - 22:20 (Turno Tarde 14:40-22:20)
      // Ferney:          22:20 - 06:00 (Turno Noche 22:20-06)
      // Kierson:         22:00 - 06:00 (Turno Noche 22-06)
      // Manuel:          06:00 - 14:00 (Turno Mañana 6-14:40)
      // Jerrson:         Descansa 1 y 2 de abril

      const operatorShiftMap: Record<string, string> = {
        'Luis Cortés': 'Turno Mañana (6-14:40)',
        'Juan Suaza': 'Turno Tarde (14-22)',
        'Juan Alejandro': 'Turno Tarde (14:40-22:20)',
        'Ferney': 'Turno Noche (22:20-06:00)',
        'Kierson': 'Turno Noche (22-06)',
        'Manuel': 'Turno Mañana (6-14:40)',
        'Jerrson': 'Turno Mañana (6-14:40)',
      };

      // Days off
      const daysOff: Record<string, number[]> = {
        'Jerrson': [1, 2],
        'Luis Cortés': [4, 5],
        'Juan Suaza': [8, 9],
        'Juan Alejandro': [11, 12],
        'Manuel': [1, 2],
      };

      let assignmentsCreated = 0;
      for (let day = 1; day <= 15; day++) {
        const date = new Date(2026, 3, day); // April 2026 (month 3 = April)

        for (const [nombre, shiftName] of Object.entries(operatorShiftMap)) {
          // Check if this operator has a day off
          const offDays = daysOff[nombre] || [];
          if (offDays.includes(day)) continue;

          const shift = createdShifts[shiftName];
          const user = createdUsers[nombre];

          if (shift && user) {
            await prisma.scheduleAssignment.upsert({
              where: {
                user_id_fecha: { user_id: user.id, fecha: date },
              },
              update: { shift_id: shift.id },
              create: { user_id: user.id, shift_id: shift.id, fecha: date },
            });
            assignmentsCreated++;
          }
        }
      }

      return res.json({
        success: true,
        message: `Cronograma Abril 1-15 cargado exitosamente`,
        operators: Object.keys(createdUsers),
        shifts: Object.keys(createdShifts),
        assignmentsCreated,
      });
    } catch (error) {
      console.error('[Admin] Error seeding April schedule:', error);
      return res.status(500).json({ error: 'Error cargando cronograma' });
    }
  });

  // ── Admin History Endpoint ─────────────────────────────────────────────────
  app.get('/api/reports/history', requireAuthenticatedUser, async (req, res) => {
    try {
      const prisma = await getPrismaClient();
      const logs = await prisma.hourlyLog.findMany({
        orderBy: { fecha_hora: 'desc' },
        take: 150,
        include: {
          user: { select: { nombre: true, rol: true, turno: true } },
          machine: true
        }
      });
      const incidents = await prisma.incident.findMany({
        orderBy: { fecha_hora: 'desc' },
        take: 50,
        include: {
          user: { select: { nombre: true, rol: true, turno: true } },
          machine: true
        }
      });
      return res.json({ logs, incidents });
    } catch (err: any) {
      console.error('[Admin History] Error:', err);
      return res.status(500).json({ error: 'Error cargando historial' });
    }
  });

  // ── Dashboard: Summary ───────────────────────────────────────────────────
  app.get('/api/dashboard/summary', requireRoles(SUPERVISOR_ROLES), async (_req, res) => {
    try {
      const prisma = await getPrismaClient();

      // Determinar el turno actual dinámicamente según la tabla de Shifts
      const shiftData = await getCurrentShiftData();
      
      let shiftStartUTC: Date;
      let currentShiftName: string;

      if (shiftData) {
        shiftStartUTC = shiftData.startUTC;
        // Nombre descriptivo: "Turno 1 (06:20 - 14:40)"
        currentShiftName = `${shiftData.shift.nombre} (${shiftData.shift.hora_inicio} - ${shiftData.shift.hora_fin})`;
      } else {
        // Fallback si no hay turnos configurados o no se encuentra uno actual
        const nowBogota = getBogotaNow();
        const hourCO = nowBogota.getUTCHours();
        let shiftStartHourCO: number;
        if (hourCO >= 6 && hourCO < 14)       shiftStartHourCO = 6;
        else if (hourCO >= 14 && hourCO < 22) shiftStartHourCO = 14;
        else                                   shiftStartHourCO = 22;

        const todayCO = getTodayInBogota(); // Representa medianoche Bogota (en términos de UTC 00:00)
        shiftStartUTC = new Date(todayCO.getTime() + (shiftStartHourCO + 5) * 60 * 60 * 1000);
        
        // Ajuste para el turno de 22h si ya es el día siguiente UTC
        if (shiftStartUTC > new Date()) shiftStartUTC = new Date(shiftStartUTC.getTime() - 24 * 60 * 60 * 1000);
        currentShiftName = getShiftName(new Date(Date.now() - 5*60*60*1000));
      }

      const reportCount = await prisma.hourlyLog.count({
        where: { fecha_hora: { gte: shiftStartUTC } }
      });
      const lastLog = await prisma.hourlyLog.findFirst({
        orderBy: { fecha_hora: 'desc' },
        select: { fecha_hora: true }
      });

      const currentTime = new Date();
      
      // Intentar obtener el objeto Shift específico para colores etc.
      const currentShiftObj = await prisma.shift.findFirst({
        where: { nombre: currentShiftName }
      });

      // TODOS los usuarios ONLINE (activos en los últimos 15 min)
      const fifteenMinsAgo = new Date(currentTime.getTime() - 15 * 60 * 1000);
      const onlineUsers = await prisma.user.findMany({
        where: { ultimo_acceso: { gte: fifteenMinsAgo } },
        select: { id: true, nombre: true, turno: true, rol: true }
      });

      // Operarios asignados al turno actual por cronograma (fecha Colombia)
      const today = getTodayInBogota();
      const assignments = await prisma.scheduleAssignment.findMany({
        where: {
          fecha: today,
          shift_id: currentShiftObj?.id || undefined
        },
        include: { user: true, shift: true }
      });

      let responsibleOperator = '';
      const assignedUserIds = new Set<string>();
      if (assignments.length > 0) {
        responsibleOperator = assignments[0].user.nombre;
        assignments.forEach(a => assignedUserIds.add(a.user.id));
      }

      const onlineOperators = onlineUsers.map(u => ({
        id: u.id,
        name: u.nombre,
        shift: u.turno || '',
        role: u.rol || '',
        isResponsible: u.nombre === responsibleOperator,
        isAssigned: assignedUserIds.has(u.id),
      }));

      const onlineNames = onlineUsers.map(u => u.nombre.split(' ')[0]);
      const displayNames = onlineNames.length > 0 ? onlineNames.join(', ') : 'N/A';

      let shiftClosingCount = 0;
      try {
        shiftClosingCount = await prisma.report.count({
          where: {
            isClosingReport: true,
            fecha_hora: { gte: today }
          }
        });
      } catch {
        shiftClosingCount = 0;
      }

      return res.json({ 
        reportCount, 
        lastReportTime: lastLog?.fecha_hora || null,
        activeOperatorsCount: onlineNames.length,
        activeOperatorsNames: displayNames,
        responsibleOperator,
        currentShift: currentShiftName,
        shiftClosingCount,
        onlineOperators,
      });
    } catch (error) {
      console.error('[Dashboard] Error al consultar resumen:', error);
      return res.json({ 
        reportCount: 0, 
        lastReportTime: null, 
        activeOperatorsCount: 0,
        activeOperatorsNames: 'N/A',
        responsibleOperator: '',
        currentShift: getShiftName(new Date(Date.now() - 5 * 60 * 60 * 1000)),
        shiftClosingCount: 0,
        onlineOperators: [],
      });
    }
  });

  // ── Dashboard: Status ────────────────────────────────────────────────────
  app.get('/api/dashboard/status', requireRoles(SUPERVISOR_ROLES), async (_req, res) => {
    try {
      const prisma = await getPrismaClient();
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      // Siempre obtener TODAS las máquinas (24 INC + 12 NAC)
      // Buscamos el log más reciente para datos y la foto más reciente histórica
      const machines = await prisma.machine.findMany({
        orderBy: [{ tipo: 'asc' }, { numero_maquina: 'asc' }],
        include: {
          logs: {
            orderBy: { fecha_hora: 'desc' },
            take: 1,
            include: {
              user: { select: { nombre: true } },
            },
          },
        },
      });

      const statusData = machines.map((machine) => {
        const log = machine.logs[0];
        let status = 'ok';
        let temp = 'N/A';
        let humidity = 'N/A';
        let lastUpdate = 'Sin datos recientes';
        let photoUrl = null;
        let observaciones = null;
        let updatedBy = null;
        let data = null;

        if (log) {
          temp = log.temp_principal_actual.toFixed(1);
          photoUrl = log.photo_url;
          observaciones = log.observaciones;
          updatedBy = log.user?.nombre || null;

          const humedadRelativa = extractObservationValue(observaciones, 'Humedad');
          const tiempoIncubacion = extractObservationValue(observaciones, 'Tiempo');
          const tempAire = extractObservationValue(observaciones, 'Temp Aire');
          const volteoNumero = extractObservationValue(observaciones, 'Volteos');
          const alarmaActiva = extractObservationValue(observaciones, 'Alarma');
          const ventilador = extractObservationValue(observaciones, 'Ventilador');
          const volteoPosicion = extractObservationValue(observaciones, 'Posicion');
          const notaOperario = extractObservationValue(observaciones, 'Nota');

          // Verificamos si el log es "actual" (< 2 horas)
          const isLogRecent = log.fecha_hora.getTime() > twoHoursAgo.getTime();

          // Parse tiempo incubacion string like "20d 12h 30m" into parts
          let tiempoDias = '0', tiempoHoras = '0', tiempoMinutos = '0';
          if (tiempoIncubacion) {
            const dMatch = tiempoIncubacion.match(/(\d+)d/);
            const hMatch = tiempoIncubacion.match(/(\d+)h/);
            const mMatch = tiempoIncubacion.match(/(\d+)m/);
            tiempoDias = dMatch ? dMatch[1] : '0';
            tiempoHoras = hMatch ? hMatch[1] : '0';
            tiempoMinutos = mMatch ? mMatch[1] : '0';
          }

          // Preferir humedad_actual (columna dedicada) sobre el texto parseado
          const humedadColumna = (log as any).humedad_actual;
          humidity = humedadColumna > 0 ? humedadColumna.toFixed(1) : (humedadRelativa || log.co2_actual.toFixed(1));
          const diffMins = Math.floor((Date.now() - log.fecha_hora.getTime()) / 60000);
          data = {
            tiempoIncubacion: { dias: tiempoDias, horas: tiempoHoras, minutos: tiempoMinutos },
            humedadRelativa: humedadColumna > 0 ? humedadColumna.toFixed(1) : (humedadRelativa || '0'),
            temperatura: temp,
            tempAire: tempAire || temp,
            volteoNumero: volteoNumero || '0',
            alarma: alarmaActiva || 'No',
            ventiladorPrincipal: ventilador || 'No',
            timestamp: log.fecha_hora.toISOString(),
            tempOvoscanReal: temp,
            tempOvoscanSP: log.temp_principal_consigna.toFixed(1),
            tempAireReal: tempAire || temp,
            tempAireSP: log.temp_secundaria_consigna.toFixed(1),
            tempSynchroReal: temp,
            tempSynchroSP: log.temp_principal_consigna.toFixed(1),
            temperaturaReal: tempAire || temp,
            temperaturaSP: log.temp_secundaria_consigna.toFixed(1),
            humedadReal: humedadRelativa || log.co2_actual.toFixed(1),
            humedadSP: log.co2_consigna.toFixed(1),
            co2Real: log.co2_actual.toFixed(1),
            co2SP: log.co2_consigna.toFixed(1),
            volteoPosicion: volteoPosicion || '',
            observaciones: notaOperario || '',
            lastUpdate: `Hace ${diffMins} min`,
            updatedBy: updatedBy,
          };

          if (alarmaActiva === 'Si' || Math.abs(log.temp_principal_actual - log.temp_principal_consigna) > 0.5) {
            status = 'alarm';
          }

          // Si el log es muy viejo, marcar como mantenimiento/sin-datos para los números,
          // pero conservamos la foto si existe.
          if (!isLogRecent) {
             status = 'maintenance';
          }

          lastUpdate = `Hace ${diffMins} min`;
        } else {
          status = 'maintenance'; 
        }

        return {
          id: machine.id,
          name: `${machine.tipo === 'INCUBADORA' ? 'INC' : 'NAC'}-${machine.numero_maquina.toString().padStart(2, '0')}`,
          type: machine.tipo.toLowerCase(),
          status,
          temp,
          humidity,
          lastUpdate,
          photoUrl,
          observaciones,
          updatedBy,
          data,
        };
      });

      return res.json(statusData);
    } catch (error) {
      console.error('[Dashboard] Error al consultar BD para status:', error);
      // Fallback: devolver las 36 máquinas predefinidas
      const defaultMachines = [];
      for (let i = 1; i <= 24; i++) {
        defaultMachines.push({
          id: `inc-${i}`,
          name: `INC-${i.toString().padStart(2, '0')}`,
          type: 'incubadora',
          status: 'maintenance',
          temp: 'N/A',
          humidity: 'N/A',
          lastUpdate: 'Sin datos recientes',
          photoUrl: null,
          observaciones: null,
          updatedBy: null,
          data: null,
        });
      }
      for (let i = 1; i <= 12; i++) {
        defaultMachines.push({
          id: `nac-${i}`,
          name: `NAC-${i.toString().padStart(2, '0')}`,
          type: 'nacedora',
          status: 'maintenance',
          temp: 'N/A',
          humidity: 'N/A',
          lastUpdate: 'Sin datos recientes',
          photoUrl: null,
          observaciones: null,
          updatedBy: null,
          data: null,
        });
      }
      return res.json(defaultMachines);
    }
  });

  // ── Dashboard: Global History (Admin History Tab) ────────────────────────
  // [NOTA] Esta ruta ha sido movida abajo (línea ~1950) para centralizar
  // la lógica de reportes y evitar duplicados.

  // ── Dashboard: Trends ────────────────────────────────────────────────────
  app.get('/api/dashboard/trends', requireRoles(SUPERVISOR_ROLES), async (req, res) => {
    try {
      const { machine, hours = '24' } = req.query;
      const prisma = await getPrismaClient();
      const hoursNum = parseInt(hours as string) || 24;
      const timeAgo = new Date(Date.now() - hoursNum * 60 * 60 * 1000);

      const filter: any = { fecha_hora: { gte: timeAgo } };
      if (machine && machine !== 'Ver: Planta Completa' && machine !== 'undefined') {
        filter.machine_id = String(machine);
      }

      const logs = await prisma.hourlyLog.findMany({
        where: filter,
        orderBy: { fecha_hora: 'asc' },
        include: { machine: true }
      });

      const trendsData = logs.map((log) => {
        // Convertir fecha_hora (UTC) a hora Colombia para el eje X del gráfico
        const localCO = new Date(log.fecha_hora.getTime() - 5 * 60 * 60 * 1000);
        const timeStr = `${localCO.getUTCHours().toString().padStart(2, '0')}:${localCO.getUTCMinutes().toString().padStart(2, '0')}`;
        return {
          time: timeStr,
          // Temperatura principal (Ovoscan/Synchro) - REAL y SP
          tempOvoscan:  log.temp_principal_actual   ?? 0,
          tempOvoscanSP: log.temp_principal_consigna ?? 0,
          // Temperatura secundaria (Aire) - REAL y SP
          tempAire:     log.temp_secundaria_actual   ?? 0,
          tempAireSP:   log.temp_secundaria_consigna ?? 0,
          // Humedad - ahora desde columna dedicada
          humedad:      (log as any).humedad_actual   ?? 0,
          humedadSP:    (log as any).humedad_consigna ?? 0,
          // CO2 - REAL y SP
          co2:          log.co2_actual   ?? 0,
          co2SP:        log.co2_consigna ?? 0,
          // Aliases para nacedoras
          temp:   log.temp_principal_actual   ?? 0,
          tempSP: log.temp_principal_consigna ?? 0,
        };
      });

      return res.json(trendsData);
    } catch (error) {
      console.error('[Dashboard] Error al consultar BD para trends:', error);
      return res.json([]);
    }
  });

  // ── Dashboard: Operators ─────────────────────────────────────────────────
  app.get('/api/dashboard/operators', requireRoles(SUPERVISOR_ROLES), async (_req, res) => {
    try {
      const prisma = await getPrismaClient();
      const users = await prisma.user.findMany({
        select: {
          id: true,
          nombre: true,
          rol: true,
          turno: true,
          estado: true,
        },
        orderBy: { nombre: 'asc' },
      });

      const mappedUsers = users.map((user) => ({
        id: user.id,
        name: user.nombre,
        role: user.rol,
        shift: user.turno,
        status: user.estado,
      }));

      return res.json(mappedUsers);
    } catch (error) {
      console.error('[Operators] Error fetching operators:', error);
      // Devolver los usuarios predefinidos como fallback para que el panel no quede vacío
      const fallback = predefinedUsers.map(u => ({
        id: u.id,
        name: u.nombre,
        role: u.rol,
        shift: u.turno,
        status: 'Activo',
      }));
      return res.json(fallback);
    }
  });

  // ── Dashboard: Machine Logs (Bitácora) ───────────────────────────────────
  app.get('/api/dashboard/machine-logs', requireRoles(SUPERVISOR_ROLES), async (req, res) => {
    try {
      const { machineId, hours = '48' } = req.query;
      if (!machineId) return res.status(400).json({ error: 'machineId es requerido' });

      const prisma = await getPrismaClient();
      const hoursNum = parseInt(hours as string) || 48;
      const timeAgo = new Date(Date.now() - hoursNum * 60 * 60 * 1000);

      const logs = await prisma.hourlyLog.findMany({
        where: {
          machine_id: String(machineId),
          fecha_hora: { gte: timeAgo },
        },
        orderBy: { fecha_hora: 'desc' },
        take: 50,
        include: {
          user: {
            select: { nombre: true },
          },
        },
      });

      const formatted = logs.map((log) => {
        const d = new Date(log.fecha_hora);
        const timeStr = `${d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        return {
          time: timeStr,
          tempPrincipal: log.temp_principal_actual?.toFixed(1) || '--',
          tempPrincipalSP: log.temp_principal_consigna?.toFixed(1) || '--',
          tempSecundaria: log.temp_secundaria_actual?.toFixed(1) || '--',
          tempSecundariaSP: log.temp_secundaria_consigna?.toFixed(1) || '--',
          co2: log.co2_actual?.toFixed(1) || '--',
          co2SP: log.co2_consigna?.toFixed(1) || '--',
          tempSuperior: log.temp_superior_actual?.toFixed(1) || '--',
          observaciones: log.observaciones || '',
          operator: log.user?.nombre || 'Desconocido',
          timestamp: log.fecha_hora.toISOString(),
        };
      });

      return res.json(formatted);
    } catch (error) {
      console.error('[Dashboard] Error al consultar logs:', error);
      return res.json([]);
    }
  });

  // ── Create Operator ──────────────────────────────────────────────────────
  app.post('/api/operators', requireRoles(SUPERVISOR_ROLES), async (req, res) => {
    try {
      const prisma = await getPrismaClient();
      const { nombre, pin, rol, turno } = req.body;

      if (!nombre || !pin || !rol) {
        return res.status(400).json({ error: 'Nombre, PIN y rol son requeridos' });
      }

      if (String(pin).length < 4 || String(pin).length > 8) {
        return res.status(400).json({ error: 'El PIN debe tener entre 4 y 8 caracteres' });
      }

      const validRoles: UserRole[] = ['OPERARIO', 'SUPERVISOR', 'JEFE'];

      if (!validRoles.includes(rol)) {
        return res.status(400).json({ error: 'Rol inválido' });
      }

      const existingUser = await prisma.user.findUnique({ where: { pin_acceso: String(pin) } });

      if (existingUser) {
        return res.status(400).json({ error: 'El PIN ya está en uso por otro usuario' });
      }

      // Generar ID slug a partir del nombre
      const slugId = String(nombre)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 40) + '-' + Date.now().toString(36);

      const newUser = await prisma.user.create({
        data: {
          id: slugId,
          nombre: String(nombre),
          pin_acceso: String(pin),
          rol,
          turno: turno || 'Turno 1',
          estado: 'Activo',
        },
        select: {
          id: true,
          nombre: true,
          rol: true,
          turno: true,
          estado: true,
        },
      });

      return res.status(201).json({
        id: newUser.id,
        name: newUser.nombre,
        role: newUser.rol,
        shift: newUser.turno,
        status: newUser.estado,
      });
    } catch (error) {
      console.error('[Operators] Error creating operator:', error);
      return res.status(500).json({ error: 'No fue posible conectar con la Base de Datos. Revisa DATABASE_URL.' });
    }
  });

  // ── Update Operator ──────────────────────────────────────────────────────
  app.put('/api/operators/:id', requireRoles(SUPERVISOR_ROLES), async (req, res) => {
    try {
      const prisma = await getPrismaClient();
      const { id } = req.params;
      const { turno, estado, pin, rol, nombre } = req.body;

      const dataToUpdate: Record<string, string> = {};
      if (turno) dataToUpdate.turno = turno;
      if (estado) dataToUpdate.estado = estado;
      if (pin) dataToUpdate.pin_acceso = pin;
      if (rol) dataToUpdate.rol = rol;
      if (nombre) dataToUpdate.nombre = nombre;

      if (Object.keys(dataToUpdate).length === 0) {
        return res.status(400).json({ error: 'No hay datos para actualizar' });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: dataToUpdate,
        select: {
          id: true,
          nombre: true,
          rol: true,
          turno: true,
          estado: true,
        },
      });

      return res.json({
        id: updatedUser.id,
        name: updatedUser.nombre,
        role: updatedUser.rol,
        shift: updatedUser.turno,
        status: updatedUser.estado,
      });
    } catch (error) {
      console.error('[Operators] Error updating operator:', error);
      return res.status(500).json({ error: 'Error de conexión a la Base de Datos al modificar el operario.' });
    }
  });

  // ── Delete Operator ──────────────────────────────────────────────────────
  app.delete('/api/operators/:id', requireRoles(['JEFE']), async (req, res) => {
    try {
      const prisma = await getPrismaClient();
      const { id } = req.params;

      // Verificar si tiene logs asociados para evitar errores de integridad
      const logsCount = await prisma.hourlyLog.count({ where: { user_id: id } });
      
      if (logsCount > 0) {
        // En lugar de borrar, desactivamos para mantener historial
        await prisma.user.update({
          where: { id },
          data: { estado: 'Inactivo' }
        });
        return res.json({ message: 'Usuario desactivado por tener registros asociados.' });
      }

      await prisma.user.delete({ where: { id } });
      return res.status(204).end();
    } catch (error) {
      console.error('[Operators] Error deleting operator:', error);
      return res.status(500).json({ error: 'No se pudo eliminar el usuario.' });
    }
  });

  // ── My Shift Report ──────────────────────────────────────────────────────
  app.get('/api/my-shift-report', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const prisma = await getPrismaClient();
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

      const logs = await prisma.hourlyLog.findMany({
        where: {
          user_id: req.user!.id,
          fecha_hora: { gte: twelveHoursAgo }
        },
        include: {
          machine: true
        },
        orderBy: [
          { machine: { numero_maquina: 'asc' } },
          { fecha_hora: 'asc' }
        ]
      });

      return res.json(logs);
    } catch (error) {
      console.error('[Report] Error fetching shift reports:', error);
      return res.status(500).json({ error: 'Error interno obteniendo reporte de turno' });
    }
  });

  // ── Incidents ────────────────────────────────────────────────────────────
  app.get('/api/dashboard/incidents', requireRoles(SUPERVISOR_ROLES), async (req, res) => {
    try {
      const { limit = '20' } = req.query;
      const prisma = await getPrismaClient();
      const incidents = await prisma.incident.findMany({
        take: parseInt(limit as string),
        orderBy: { fecha_hora: 'desc' },
        include: {
          user: { select: { nombre: true } },
          machine: { select: { tipo: true, numero_maquina: true } }
        }
      });
      return res.json(incidents);
    } catch (error) {
      console.error('[Incidents] Error:', error);
      return res.status(500).json({ error: 'Fallo al obtener incidentes' });
    }
  });

  app.post('/api/dashboard/incidents', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const { titulo, descripcion, tipo, machine_id } = req.body;
      const prisma = await getPrismaClient();
      const databaseUser = await resolveDatabaseUser(req.user!);

      const incident = await prisma.incident.create({
        data: {
          user_id: databaseUser.id,
          machine_id: machine_id || null,
          titulo,
          descripcion,
          tipo: tipo || 'INCIDENT'
        }
      });
      return res.status(201).json(incident);
    } catch (error) {
      console.error('[Incidents] Error creating:', error);
      return res.status(500).json({ error: 'No se pudo registrar el incidente' });
    }
  });


  // ── Advanced Shifts & Schedules (Admin) ──────────────────────────────────
  app.get('/api/admin/shifts', requireRoles(SUPERVISOR_ROLES), async (_req, res) => {
    try {
      const prisma = await getPrismaClient();
      const shifts = await prisma.shift.findMany();
      return res.json(shifts);
    } catch (error) {
      return res.status(500).json({ error: 'Error cargando turnos' });
    }
  });

  app.post('/api/admin/shifts', requireRoles(['JEFE']), async (req, res) => {
    try {
      const { nombre, hora_inicio, hora_fin, color } = req.body;
      const prisma = await getPrismaClient();
      const shift = await prisma.shift.create({
        data: { nombre, hora_inicio, hora_fin, color }
      });
      sendEventToAll({ type: 'SHIFT_UPDATE', message: 'Se han actualizado los catálogos de turnos.' });
      return res.status(201).json(shift);
    } catch (error) {
      return res.status(500).json({ error: 'No se pudo crear el turno' });
    }
  });

  app.delete('/api/admin/shifts/:id', requireRoles(['JEFE']), async (req, res) => {
    try {
      const { id } = req.params;
      const prisma = await getPrismaClient();
      
      const assignments = await prisma.scheduleAssignment.count({
        where: { shift_id: id }
      });
      
      if (assignments > 0) {
        return res.status(400).json({ error: 'Turno en uso: No se puede eliminar porque tiene operarios asignados.' });
      }

      await prisma.shift.delete({ where: { id } });
      sendEventToAll({ type: 'SHIFT_UPDATE', message: 'Un turno ha sido eliminado.' });
      return res.status(204).end();
    } catch (error) {
      return res.status(500).json({ error: 'Error al eliminar el turno' });
    }
  });

  app.get('/api/admin/assignments', requireRoles(SUPERVISOR_ROLES), async (req, res) => {
    try {
      const { date } = req.query;
      const prisma = await getPrismaClient();
      const assignments = await prisma.scheduleAssignment.findMany({
        where: date ? { fecha: new Date(date as string) } : undefined,
        include: {
          user: { select: { nombre: true, id: true } },
          shift: true
        }
      });
      return res.json(assignments);
    } catch (error) {
      return res.status(500).json({ error: 'Error cargando asignaciones' });
    }
  });

  app.post('/api/admin/assignments', requireRoles(SUPERVISOR_ROLES), async (req, res) => {
    try {
      const { user_id, shift_id, fecha } = req.body;
      const prisma = await getPrismaClient();

      // Normalizar fecha a medianoche UTC para que el @@unique funcione consistentemente
      const dateObj = new Date(fecha);
      dateObj.setUTCHours(0, 0, 0, 0);

      const assignment = await prisma.scheduleAssignment.upsert({
        where: { user_id_fecha: { user_id, fecha: dateObj } },
        update: { shift_id },
        create: { user_id, shift_id, fecha: dateObj }
      });
      
      const shift = await prisma.shift.findUnique({ where: { id: shift_id } });
      sendEventToUser(user_id, { 
        type: 'NEW_ASSIGNMENT', 
        message: `Tu horario para el ${dateObj.toLocaleDateString()} ha sido actualizado al turno "${shift?.nombre}".`,
        assignment 
      });

      return res.json(assignment);
    } catch (error) {
      console.error('[Assignments] Error upserting:', error);
      return res.status(500).json({ error: 'Fallo al asignar turno' });
    }
  });

  app.delete('/api/admin/assignments/:id', requireRoles(SUPERVISOR_ROLES), async (req, res) => {
    try {
      const { id } = req.params;
      const prisma = await getPrismaClient();
      await prisma.scheduleAssignment.delete({ where: { id } });
      return res.status(204).end();
    } catch (error) {
      return res.status(500).json({ error: 'Error al eliminar asignación' });
    }
  });

  // ── Clear Database (Admin Only) ──────────────────────────────────────────
  app.post('/api/admin/clear-db', requireRoles(['JEFE']), async (_req, res) => {
    try {
      const prisma = await getPrismaClient();
      await prisma.$transaction([
        prisma.report.deleteMany(),
        prisma.incident.deleteMany(),
        prisma.hourlyLog.deleteMany(),
        prisma.scheduleAssignment.deleteMany(),
        prisma.session.deleteMany(),
        prisma.break.deleteMany(),
      ]);
      return res.json({ success: true, message: 'Base de datos limpiada exitosamente' });
    } catch (error) {
      console.error('[Admin] Error clearing DB:', error);
      return res.status(500).json({ error: 'Error limpiando la base de datos' });
    }
  });

  app.get('/api/admin/users', requireRoles(SUPERVISOR_ROLES), async (_req, res) => {
    try {
      const prisma = await getPrismaClient();
      const users = await prisma.user.findMany({ 
        where: { estado: 'Activo' },
        orderBy: { nombre: 'asc' }
      });
      return res.json(users);
    } catch (err) {
      return res.status(500).json({ error: 'Fallo al obtener usuarios' });
    }
  });

  // ── Operator Perspective ─────────────────────────────────────────────────
  app.get('/api/my-schedule', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const prisma = await getPrismaClient();
      const dbUser = await resolveDatabaseUser(req.user!);
      const assignments = await prisma.scheduleAssignment.findMany({
        where: { user_id: dbUser.id, fecha: { gte: getTodayInBogota() } },
        include: { shift: true },
        orderBy: { fecha: 'asc' },
        take: 7
      });
      return res.json(assignments);
    } catch (error) {
       return res.status(500).json({ error: 'Error al consultar mi horario' });
    }
  });

  // ── CRON JOBS: Alert System ──────────────────────────────────────────────
  // Se ejecuta cada 1 minuto
  cron.schedule('* * * * *', async () => {
    try {
      const prisma = await getPrismaClient();
      const now = new Date();
      const timeStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
      
      // 1. Alertas de 15 minutos antes
      const targetTime = new Date(now.getTime() + 15 * 60 * 1000);
      const targetTimeStr = targetTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
      
      const assignmentsStartingSoon = await prisma.scheduleAssignment.findMany({
        where: { 
          fecha: { gte: new Date(now.toDateString()), lt: new Date(now.getTime() + 24*60*60*1000) },
          shift: { hora_inicio: targetTimeStr }
        },
        include: { user: true, shift: true }
      });

      assignmentsStartingSoon.forEach(asm => {
        sendEventToUser(asm.user_id, {
          type: 'SHIFT_REMINDER',
          title: '¡Prepárate!',
          message: `Tu turno "${asm.shift.nombre}" comienza en 15 minutos (${asm.shift.hora_inicio}).`
        });
      });

      // 2. Recordatorios cada 5 minutos si no ha iniciado sesión
      if (now.getMinutes() % 5 === 0) {
        // En un escenario real verificaríamos logs de "check-in". 
        // Simplificamos: si su ultimo_acceso fue hace más de 10 min y debería estar trabajando.
        const workInProgress = await prisma.scheduleAssignment.findMany({
          where: {
            fecha: new Date(now.toDateString()),
            shift: {
              hora_inicio: { lte: timeStr },
              hora_fin: { gte: timeStr }
            }
          },
          include: { user: true }
        });

        workInProgress.forEach(asm => {
          const lastAccess = asm.user.ultimo_acceso;
          if (!lastAccess || (now.getTime() - lastAccess.getTime()) > 10 * 60 * 1000) {
            sendEventToUser(asm.user_id, {
              type: 'LOGIN_REMINDER',
              title: 'Pendiente Ingreso',
              message: 'Tu turno ya comenzó. No olvides registrar tu ingreso en la app.'
            });
          }
        });
      }
    } catch (err) {
      console.error('[CRON] Error evaluando turnos:', err);
    }
  });

  // ── Health Check ─────────────────────────────────────────────────────────

  app.get('/api/health-db', async (_req, res) => {
    try {
      const prisma = await getPrismaClient();
      await prisma.$executeRaw`SELECT 1`;
      return res.status(200).json({ status: 'Connected! Supabase DB reached.', users: predefinedUsers.length });
    } catch (error: any) {
      console.error('[Health] DB Error:', error);
      return res.status(500).json({ status: 'Failed', error: error.message || 'Error de conexion' });
    }
  });

  // ── Seed endpoint (útil para forzar semillado desde panel admin) ─────────
  app.post('/api/seed', requireRoles(['JEFE']), async (_req, res) => {
    await seedPredefinedUsers();
    return res.json({ message: `${predefinedUsers.length} usuarios sincronizados.` });
  });

  // ── Admin History Endpoint ─────────────────────────────────────────────────
  // Nota: esta es la ÚNICA definición de GET /api/reports/history en la app.
  // La importación del controller (getHistory) fue eliminada de la doble-ruta.
  app.get('/api/reports/history', requireAuthenticatedUser, async (req, res) => {
    try {
      const prisma = await getPrismaClient();
      
      const logs = await prisma.hourlyLog.findMany({
        orderBy: { fecha_hora: 'desc' },
        take: 200,
        include: {
          user: { select: { nombre: true, rol: true, turno: true } },
          machine: true
        }
      });
      
      const incidents = await prisma.incident.findMany({
        orderBy: { fecha_hora: 'desc' },
        take: 50,
        include: {
          user: { select: { nombre: true, rol: true, turno: true } },
          machine: true
        }
      });
      
      return res.json({ logs, incidents });
    } catch (err: any) {
      console.error('[Admin History] Error details:', err?.message || err);
      return res.status(500).json({ error: 'Error cargando historial', details: err?.message });
    }
  });

  // ==========================================================================
  // SOLICITUDES Y PERMISOS (LeaveRequest)
  // ==========================================================================

  // ── GET /api/requests - Listar solicitudes (supervisor ve todas, operario ve las suyas)
  app.get('/api/requests', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const prisma = await getPrismaClient();
      const isSupervisor = req.user && SUPERVISOR_ROLES.includes(req.user.role);

      const where = isSupervisor
        ? {} // supervisores ven todas
        : { requester_id: req.user!.id }; // operarios solo ven las suyas

      const requests = await (prisma as any).leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          requester: { select: { nombre: true, turno: true, rol: true } },
          reviewer: { select: { nombre: true } }
        }
      });

      return res.json(requests);
    } catch (error) {
      console.error('[Requests] Error fetching:', error);
      return res.status(500).json({ error: 'Error cargando solicitudes' });
    }
  });

  // ── POST /api/requests - Crear nueva solicitud (operario)
  app.post('/api/requests', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const { tipo, fecha_inicio, fecha_fin, motivo, observaciones } = req.body;

      if (!tipo || !fecha_inicio || !fecha_fin || !motivo) {
        return res.status(400).json({ error: 'Tipo, fechas y motivo son requeridos' });
      }

      const prisma = await getPrismaClient();
      const databaseUser = await resolveDatabaseUser(req.user!);

      const newRequest = await (prisma as any).leaveRequest.create({
        data: {
          tipo,
          fecha_inicio: new Date(fecha_inicio),
          fecha_fin: new Date(fecha_fin),
          motivo: String(motivo).slice(0, 500),
          observaciones: observaciones ? String(observaciones).slice(0, 1000) : null,
          estado: 'PENDIENTE',
          requester_id: databaseUser.id,
        },
        include: {
          requester: { select: { nombre: true, turno: true, rol: true } },
          reviewer: { select: { nombre: true } }
        }
      });

      // Notificar a supervisores vía SSE
      sendEventToAll({
        type: 'NEW_REQUEST',
        message: `Nueva solicitud de ${databaseUser.nombre}: ${tipo}`,
        timestamp: new Date().toISOString()
      });

      return res.status(201).json(newRequest);
    } catch (error) {
      console.error('[Requests] Error creating:', error);
      return res.status(500).json({ error: 'Error creando solicitud' });
    }
  });

  // ── PATCH /api/requests/:id/review - Revisar/aprobar/rechazar solicitud (supervisor/jefe)
  app.patch('/api/requests/:id/review', requireRoles(SUPERVISOR_ROLES), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { estado, respuesta } = req.body;

      if (!['APROBADO', 'RECHAZADO'].includes(estado)) {
        return res.status(400).json({ error: 'Estado debe ser APROBADO o RECHAZADO' });
      }

      const prisma = await getPrismaClient();
      const databaseUser = await resolveDatabaseUser(req.user!);

      const updated = await (prisma as any).leaveRequest.update({
        where: { id },
        data: {
          estado,
          respuesta: respuesta ? String(respuesta).slice(0, 500) : null,
          reviewer_id: databaseUser.id,
        },
        include: {
          requester: { select: { nombre: true, turno: true, rol: true } },
          reviewer: { select: { nombre: true } }
        }
      });

      // Notificar al operario que solicitó
      sendEventToUser(updated.requester_id, {
        type: 'REQUEST_REVIEWED',
        title: estado === 'APROBADO' ? '✅ Solicitud Aprobada' : '❌ Solicitud Rechazada',
        message: `Tu solicitud de ${updated.tipo} ha sido ${estado.toLowerCase()}.${respuesta ? ' Respuesta: ' + respuesta : ''}`,
        estado,
      });

      return res.json(updated);
    } catch (error) {
      console.error('[Requests] Error reviewing:', error);
      return res.status(500).json({ error: 'Error procesando revisión' });
    }
  });

  // ── DELETE /api/requests/:id - Cancelar solicitud propia (operario, solo si PENDIENTE)
  app.delete('/api/requests/:id', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const prisma = await getPrismaClient();
      const databaseUser = await resolveDatabaseUser(req.user!);
      const isSupervisor = SUPERVISOR_ROLES.includes(req.user!.role);

      const existing = await (prisma as any).leaveRequest.findUnique({ where: { id } });

      if (!existing) return res.status(404).json({ error: 'Solicitud no encontrada' });
      if (!isSupervisor && existing.requester_id !== databaseUser.id) {
        return res.status(403).json({ error: 'No puedes eliminar esta solicitud' });
      }
      if (!isSupervisor && existing.estado !== 'PENDIENTE') {
        return res.status(400).json({ error: 'Solo puedes cancelar solicitudes pendientes' });
      }

      await (prisma as any).leaveRequest.delete({ where: { id } });
      return res.status(204).end();
    } catch (error) {
      console.error('[Requests] Error deleting:', error);
      return res.status(500).json({ error: 'Error eliminando solicitud' });
    }
  });

  // ── GET /api/requests/stats - Estadísticas de solicitudes para el dashboard
  app.get('/api/requests/stats', requireRoles(SUPERVISOR_ROLES), async (_req, res) => {
    try {
      const prisma = await getPrismaClient();
      const pending = await (prisma as any).leaveRequest.count({ where: { estado: 'PENDIENTE' } });
      const approved = await (prisma as any).leaveRequest.count({ where: { estado: 'APROBADO' } });
      const rejected = await (prisma as any).leaveRequest.count({ where: { estado: 'RECHAZADO' } });
      return res.json({ pending, approved, rejected, total: pending + approved + rejected });
    } catch (error) {
      return res.json({ pending: 0, approved: 0, rejected: 0, total: 0 });
    }
  });

  // ── Finalization ─────────────────────────────────────────────────────────

  // ── Evidence API ──────────────────────────────────────────────────────────
  // GET /api/evidence/machine/:machineId — últimas fotos de una máquina (Admin)
  app.get('/api/evidence/machine/:machineId', requireRoles(SUPERVISOR_ROLES), async (req, res) => {
    try {
      const { machineId } = req.params;
      const { limit = '50', days = '30' } = req.query;
      const prisma = await getPrismaClient();

      const daysNum = parseInt(days as string) || 30;
      const limitNum = parseInt(limit as string) || 50;
      const since = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

      // Normaliza el machineId del frontend ("inc-1") al ID de la BD ("inc-1" → buscar por tipo+numero)
      const logs = await prisma.hourlyLog.findMany({
        where: {
          machine: {
            OR: [
              { id: machineId },
              { id: machineId.toLowerCase() },
            ]
          },
          photo_url: { not: null },
          fecha_hora: { gte: since },
        },
        orderBy: { fecha_hora: 'desc' },
        take: limitNum,
        include: {
          user: { select: { nombre: true, turno: true } },
          machine: { select: { tipo: true, numero_maquina: true, id: true } },
        },
      });

      const result = logs.map(l => ({
        id: l.id,
        photoUrl: l.photo_url,
        fecha_hora: l.fecha_hora,
        operario: l.user?.nombre || 'Desconocido',
        turno: l.user?.turno || '',
        machine: l.machine ? `${l.machine.tipo === 'INCUBADORA' ? 'INC' : 'NAC'}-${l.machine.numero_maquina.toString().padStart(2, '0')}` : machineId,
        observaciones: l.observaciones || '',
        itemType: 'photo' as const,
      }));

      return res.json({ photos: result, total: result.length });
    } catch (error) {
      console.error('[Evidence] Error fetching machine evidence:', error);
      return res.status(500).json({ error: 'Error cargando evidencias de la máquina' });
    }
  });

  // GET /api/evidence/mine — fotos y PDFs del operario autenticado (Mis Evidencias)
  app.get('/api/evidence/mine', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const prisma = await getPrismaClient();
      const databaseUser = await resolveDatabaseUser(req.user!);
      const { page = '1', limit = '40' } = req.query;
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, parseInt(limit as string) || 40);
      const skip = (pageNum - 1) * limitNum;

      // Fotos de reportes horarios
      const [photos, reports] = await Promise.all([
        prisma.hourlyLog.findMany({
          where: { user_id: databaseUser.id, photo_url: { not: null } },
          orderBy: { fecha_hora: 'desc' },
          take: limitNum,
          skip,
          include: {
            machine: { select: { tipo: true, numero_maquina: true, id: true } },
          },
        }),
        prisma.report.findMany({
          where: { user_id: databaseUser.id, pdfUrl: { not: null } },
          orderBy: { fecha_hora: 'desc' },
          take: 20,
          select: {
            id: true,
            fecha_hora: true,
            pdfUrl: true,
            isClosingReport: true,
          },
        }),
      ]);

      const photoItems = photos.map(l => ({
        id: l.id,
        itemType: 'photo' as const,
        url: l.photo_url!,
        fecha_hora: l.fecha_hora,
        machine: l.machine
          ? `${l.machine.tipo === 'INCUBADORA' ? 'INC' : 'NAC'}-${l.machine.numero_maquina.toString().padStart(2, '0')}`
          : 'Sin máquina',
        machineId: l.machine?.id || null,
        observaciones: l.observaciones || '',
      }));

      const pdfItems = reports.map(r => ({
        id: r.id,
        itemType: 'pdf' as const,
        url: r.pdfUrl!,
        fecha_hora: r.fecha_hora,
        machine: r.isClosingReport ? 'Reporte de Cierre' : 'Reporte Horario',
        machineId: null,
        observaciones: r.isClosingReport ? 'Cierre de turno' : 'Reporte horario',
      }));

      // Combinar y ordenar por fecha
      const combined = [...photoItems, ...pdfItems].sort(
        (a, b) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime()
      );

      return res.json({ items: combined, operario: databaseUser.nombre, page: pageNum });
    } catch (error) {
      console.error('[Evidence] Error fetching mine:', error);
      return res.status(500).json({ error: 'Error cargando tus evidencias' });
    }
  });

  return app;
}

function getShiftName(date: Date) {
  const hour = date.getHours();
  if (hour >= 6 && hour < 14) return 'Turno 1';
  if (hour >= 14 && hour < 22) return 'Turno 2';
  return 'Turno 3';
}

/**
 * Retorna un objeto Date con la hora actual en Colombia (UTC-5)
 * pero desplazado para que sus métodos getUTC* funcionen como locales de Colombia.
 */
function getBogotaNow(): Date {
  const colombiaOffset = -5 * 60 * 60 * 1000;
  return new Date(Date.now() + colombiaOffset);
}

/**
 * Retorna el turno actual y su hora de inicio (UTC real) para filtrado den BD.
 */
async function getCurrentShiftData(): Promise<{ shift: any; startUTC: Date } | null> {
  try {
    const prisma = await getPrismaClient();
    const bogotaNow = getBogotaNow();
    const timeStr = bogotaNow.getUTCHours().toString().padStart(2, '0') + ':' + 
                    bogotaNow.getUTCMinutes().toString().padStart(2, '0');

    const shifts = await prisma.shift.findMany();
    
    // Buscar el turno que cubre la hora actual (considerando cruces de medianoche)
    const currentShift = shifts.find(s => {
      if (s.hora_inicio <= s.hora_fin) {
        return timeStr >= s.hora_inicio && timeStr <= s.hora_fin;
      } else {
        return timeStr >= s.hora_inicio || timeStr <= s.hora_fin;
      }
    });

    if (!currentShift) return null;

    const [h, m] = currentShift.hora_inicio.split(':').map(Number);
    const startShiftBogota = getTodayInBogota(); // Medianoche hoy (UTC 00:00)
    startShiftBogota.setUTCHours(h, m, 0, 0);

    // Ajuste si el turno cruza medianoche y ya estamos en el día siguiente al inicio
    if (currentShift.hora_inicio > currentShift.hora_fin && timeStr <= currentShift.hora_fin) {
      startShiftBogota.setTime(startShiftBogota.getTime() - 24 * 60 * 60 * 1000);
    }

    // Convertir a UTC real sumando el offset (+5h)
    const startUTC = new Date(startShiftBogota.getTime() + 5 * 60 * 60 * 1000);

    return { shift: currentShift, startUTC };
  } catch (error) {
    console.warn('[Shift] Error calculating current shift:', error);
    return null;
  }
}

/**
 * Retorna la fecha de HOY en Colombia (America/Bogota, UTC-5)
 * normalizada a la medianoche UTC para coincidir con el almacenamiento de la BD.
 */
function getTodayInBogota(): Date {
  // Colombia es UTC-5 siempre
  const now = new Date();
  const colombiaOffset = -5 * 60 * 60 * 1000;
  const colombiaTime = new Date(now.getTime() + colombiaOffset);
  
  colombiaTime.setUTCHours(0, 0, 0, 0);
  return colombiaTime;
}
