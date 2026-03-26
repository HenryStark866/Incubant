// Manual Redeploy for CORS sync by HenryStark866
import crypto from 'crypto';
import cron from 'node-cron';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import type { PrismaClient } from '@prisma/client';

type UserRole = 'OPERARIO' | 'SUPERVISOR' | 'JEFE';

type SessionUser = {
  id: string;
  name: string;
  role: UserRole;
  shift?: string;
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
  tempOvoscan?: string;
  tempAire?: string;
  volteoNumero?: string;
  volteoPosicion?: string;
  alarma?: 'Si' | 'No';
  temperatura?: string;
  humedadRelativa?: string;
  co2?: string;
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

    return {
      id: session.user.id,
      name: session.user.nombre,
      role: session.user.rol as UserRole,
      shift: session.user.turno,
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
  return res.status(200).json({ 
    user: {
      id: user.id,
      name: user.nombre,
      role: user.rol,
      shift: user.turno
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

  const details = [
    timeStr,
    data.humedadRelativa ? `Humedad: ${data.humedadRelativa}%` : null,
    data.co2 ? `CO2: ${data.co2}%` : null,
    data.tempAire ? `Temp Aire: ${data.tempAire}` : null,
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
    }
    console.log(`[Seed] ${predefinedUsers.length} usuarios predefinidos sincronizados en BD.`);
  } catch (error) {
    console.warn('[Seed] No se pudo sembrar usuarios (BD no disponible). El fallback local estará activo.', error instanceof Error ? error.message : '');
  }
}

// ==========================================================================
// EXPRESS APP
// ==========================================================================
export function createApiApp(): Express {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  
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

  // ── Health Check ──────────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

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
          const mainTemp = toNumberOrNull(d.tempOvoscan) ?? toNumberOrNull(d.temperatura) ?? 0;
          const secondaryTemp = toNumberOrNull(d.tempAire) ?? mainTemp;
          const co2 = toNumberOrNull(d.co2) ?? 0;
          const humidity = toNumberOrNull(d.humedadRelativa) ?? 0;

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

          return {
            user_id: databaseUser.id,
            machine_id: resolvedMachine.id,
            photo_url: machine.photoUrl || null,
            temp_principal_actual: mainTemp,
            temp_principal_consigna: mainTemp,
            co2_actual: humidity > 0 ? humidity : co2,  // Guardamos humedad en co2_actual si disponible
            co2_consigna: humidity > 0 ? humidity : co2,
            fan_speed: 0,
            temp_secundaria_actual: secondaryTemp,
            temp_secundaria_consigna: secondaryTemp,
            is_na: machine.type === 'nacedora',
            temp_superior_actual: null,
            observaciones: buildObservationSummary(d),
          };
        }));

        const result = await prisma.hourlyLog.createMany({
          data: logsToInsert,
        });

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

  // ── Dashboard: Summary ───────────────────────────────────────────────────
  app.get('/api/dashboard/summary', requireRoles(SUPERVISOR_ROLES), async (_req, res) => {
    try {
      const prisma = await getPrismaClient();
      const reportCount = await prisma.hourlyLog.count();
      const lastLog = await prisma.hourlyLog.findFirst({
        orderBy: { fecha_hora: 'desc' },
        select: { fecha_hora: true }
      });

      const currentTime = new Date();
      const shifts = await prisma.shift.findMany();
      const timeStr = currentTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
      
      const currentShiftObj = shifts.find(s => {
        if (s.hora_inicio <= s.hora_fin) {
          return timeStr >= s.hora_inicio && timeStr <= s.hora_fin;
        } else {
          return timeStr >= s.hora_inicio || timeStr <= s.hora_fin;
        }
      });

      const currentShift = currentShiftObj?.nombre || getShiftName(currentTime);

      // 2. Buscar operarios asignados y ONLINE
      const fifteenMinsAgo = new Date(currentTime.getTime() - 15 * 60 * 1000);
      const onlineUsers = await prisma.user.findMany({
        where: {
          ultimo_acceso: { gte: fifteenMinsAgo },
          rol: 'OPERARIO'
        },
        select: { nombre: true }
      });

      const onlineNames = onlineUsers.map(u => u.nombre.split(' ')[0]);

      // 3. Buscar asignados por horario (para mostrar quién debería estar)
      const today = new Date();
      today.setHours(0,0,0,0);

      const assignments = await prisma.scheduleAssignment.findMany({
        where: {
          fecha: today,
          shift_id: currentShiftObj?.id
        },
        include: { user: true }
      });

      const assignedNames = assignments.map(a => a.user.nombre.split(' ')[0]);

      // Priorizar mostrar los que están ONLINE ahora mismo
      let displayNames = 'N/A';
      if (onlineNames.length > 0) {
        displayNames = onlineNames.join(', ') + ' (Online)';
      } else if (assignedNames.length > 0) {
        displayNames = assignedNames.join(', ') + ' (Asignado)';
      }

      return res.json({ 
        reportCount, 
        lastReportTime: lastLog?.fecha_hora || null,
        activeOperatorsCount: onlineNames.length || assignedNames.length,
        activeOperatorsNames: displayNames,
        currentShift
      });
    } catch (error) {
      console.error('[Dashboard] Error al consultar resumen:', error);
      return res.json({ reportCount: 0, lastReportTime: null, activeOperatorsCount: 0 });
    }
  });

  // ── Dashboard: Status ────────────────────────────────────────────────────
  app.get('/api/dashboard/status', requireRoles(SUPERVISOR_ROLES), async (_req, res) => {
    try {
      const prisma = await getPrismaClient();
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const machines = await prisma.machine.findMany({
        include: {
          logs: {
            where: { fecha_hora: { gte: twoHoursAgo } },
            orderBy: { fecha_hora: 'desc' },
            take: 1,
            include: {
              user: {
                select: {
                  nombre: true,
                },
              },
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
        let data = undefined;

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

          humidity = humedadRelativa || log.co2_actual.toFixed(1);
          data = {
            tiempoIncubacion,
            humedadRelativa,
            temperatura: temp,
            tempAire,
            volteoNumero,
            alarma: alarmaActiva,
            ventiladorPrincipal: ventilador,
            timestamp: log.fecha_hora.toISOString() // Añadimos el tiempo real del reporte
          };

          if (alarmaActiva === 'Si' || Math.abs(log.temp_principal_actual - log.temp_principal_consigna) > 0.5) {
            status = 'alarm';
          }

          const diffMins = Math.floor((Date.now() - log.fecha_hora.getTime()) / 60000);
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
      return res.json([]);
    }
  });

  // ── Dashboard: Trends ────────────────────────────────────────────────────
  app.get('/api/dashboard/trends', requireRoles(SUPERVISOR_ROLES), async (req, res) => {
    try {
      const { machine } = req.query;
      const prisma = await getPrismaClient();
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const filter: any = { fecha_hora: { gte: twentyFourHoursAgo } };
      if (machine && machine !== 'Ver: Planta Completa' && machine !== 'undefined') {
        filter.machine_id = String(machine);
      }

      const logs = await prisma.hourlyLog.findMany({
        where: filter,
        orderBy: { fecha_hora: 'asc' },
      });

      const grouped: Record<string, { tempSum: number; humSum: number; count: number }> = {};

      logs.forEach((log) => {
        const hour = `${log.fecha_hora.toISOString().substring(11, 13)}:00`;
        if (!grouped[hour]) {
          grouped[hour] = { tempSum: 0, humSum: 0, count: 0 };
        }

        grouped[hour].tempSum += log.temp_principal_actual;
        grouped[hour].humSum += log.co2_actual;
        grouped[hour].count += 1;
      });

      const trendsData = Object.keys(grouped).map((hour) => ({
        time: hour,
        temp: Number((grouped[hour].tempSum / grouped[hour].count).toFixed(1)),
        humidity: Number((grouped[hour].humSum / grouped[hour].count).toFixed(1)),
      }));

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
      const { turno, estado } = req.body;

      const dataToUpdate: Record<string, string> = {};
      if (turno) dataToUpdate.turno = turno;
      if (estado) dataToUpdate.estado = estado;

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
      const assignment = await prisma.scheduleAssignment.upsert({
        where: { user_id_fecha: { user_id, fecha: new Date(fecha) } },
        update: { shift_id },
        create: { user_id, shift_id, fecha: new Date(fecha) }
      });
      
      const shift = await prisma.shift.findUnique({ where: { id: shift_id } });
      sendEventToUser(user_id, { 
        type: 'NEW_ASSIGNMENT', 
        message: `Tu horario para el ${new Date(fecha).toLocaleDateString()} ha sido actualizado al turno "${shift?.nombre}".`,
        assignment 
      });

      return res.json(assignment);
    } catch (error) {
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
        where: { user_id: dbUser.id, fecha: { gte: new Date() } },
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

  // ── Finalization ─────────────────────────────────────────────────────────

  return app;
}

function getShiftName(date: Date) {
  const hour = date.getHours();
  if (hour >= 6 && hour < 14) return 'Turno 1';
  if (hour >= 14 && hour < 22) return 'Turno 2';
  return 'Turno 3';
}
