import crypto from 'crypto';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
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
  { id: 'juan-alejandro', nombre: 'Juan Alejandro', pin_acceso: '1111',   rol: 'OPERARIO',   turno: 'Turno 1' },
  { id: 'juan-suaza',     nombre: 'Juan Suaza',     pin_acceso: '2222',   rol: 'OPERARIO',   turno: 'Turno 1' },
  { id: 'ferney-tabares', nombre: 'Ferney Tabares', pin_acceso: '3333',   rol: 'OPERARIO',   turno: 'Turno 2' },
  { id: 'turnero',        nombre: 'Turnero',        pin_acceso: '4444',   rol: 'OPERARIO',   turno: 'Turno 1' },
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
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }

  return globalForPrisma.prisma;
}

// ==========================================================================
// SESSION HELPERS
// ==========================================================================
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

function signSessionPayload(payload: string) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
}

function buildSessionCookie(token: string) {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secureFlag}`;
}

function clearSessionCookie() {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`;
}

function createSessionToken(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({
    ...user,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  })).toString('base64url');

  return `${payload}.${signSessionPayload(payload)}`;
}

function getSessionUserFromRequest(req: Request): SessionUser | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];

  if (!token) {
    return null;
  }

  const [payload, signature] = token.split('.');

  if (!payload || !signature || signature !== signSessionPayload(payload)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionUser & { exp: number };

    if (!decoded.exp || decoded.exp < Date.now()) {
      return null;
    }

    return {
      id: decoded.id,
      name: decoded.name,
      role: decoded.role,
      shift: decoded.shift,
    };
  } catch {
    return null;
  }
}

function attachSessionUser(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  req.user = getSessionUserFromRequest(req);
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

function sendAuthenticatedUser(res: Response, user: SessionUser) {
  res.setHeader('Set-Cookie', buildSessionCookie(createSessionToken(user)));
  return res.status(200).json({ user });
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
  app.use(attachSessionUser);

  // Intentar semillado al arrancar (no bloquea el arranque)
  void seedPredefinedUsers();

  // ── Session ──────────────────────────────────────────────────────────────
  app.get('/api/session', (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No hay sesión activa' });
    }

    return res.json({ user: req.user });
  });

  app.post('/api/logout', (_req, res) => {
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
        return sendAuthenticatedUser(res, {
          id: user.id,
          name: user.nombre,
          role: user.rol as UserRole,
          shift: user.turno,
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
        name: localUser.nombre,
        role: localUser.rol,
        shift: localUser.turno,
      });
    }

    return res.status(401).json({ error: 'Credenciales inválidas' });
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
      return res.json({ reportCount });
    } catch (error) {
      console.error('[Dashboard] Error al consultar conteo de reportes:', error);
      return res.json({ reportCount: 0 });
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

  return app;
}
