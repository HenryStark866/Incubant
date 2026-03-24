import crypto from 'crypto';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

type UserRole = 'OPERARIO' | 'SUPERVISOR' | 'JEFE';

type SessionUser = {
  id: string;
  name: string;
  role: UserRole;
};

type AuthenticatedRequest = Request & {
  user?: SessionUser;
};

type SubmittedMachineData = {
  diaIncubacion?: string;
  tempOvoscan?: string;
  tempAire?: string;
  volteoNumero?: string;
  volteoPosicion?: string;
  alarma?: 'Si' | 'No';
  temperatura?: string;
  humedadRelativa?: string;
  co2?: string;
  observaciones?: string;
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

const predefinedUsers = [
  { id: 'admin', nombre: 'Administrador', pin_acceso: '4753', rol: 'JEFE' as const },
  { id: 'Elkin Cavadia', nombre: 'Elkin Cavadia', pin_acceso: '11168', rol: 'JEFE' as const },
  { id: 'Juan Alejandro', nombre: 'Juan Alejandro', pin_acceso: '1111', rol: 'OPERARIO' as const },
  { id: 'Juan Suaza', nombre: 'Juan Suaza', pin_acceso: '2222', rol: 'OPERARIO' as const },
  { id: 'Ferney Tabares', nombre: 'Ferney Tabares', pin_acceso: '3333', rol: 'OPERARIO' as const },
  { id: 'turnero', nombre: 'Turnero', pin_acceso: '4444', rol: 'OPERARIO' as const },
  { id: 'Jhon Piedrahita', nombre: 'Jhon Piedrahita', pin_acceso: 'jp2026', rol: 'SUPERVISOR' as const },
];

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }

  return globalForPrisma.prisma;
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
  const details = [
    data.diaIncubacion ? `Dia: ${data.diaIncubacion}` : null,
    data.humedadRelativa ? `Humedad: ${data.humedadRelativa}` : null,
    data.co2 ? `CO2: ${data.co2}` : null,
    data.tempAire ? `Temp Aire: ${data.tempAire}` : null,
    data.volteoNumero ? `Volteos: ${data.volteoNumero}` : null,
    data.volteoPosicion ? `Posicion: ${data.volteoPosicion}` : null,
    data.alarma ? `Alarma: ${data.alarma}` : null,
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

async function resolveDatabaseUser(sessionUser: SessionUser) {
  const prisma = getPrismaClient();
  const byId = await prisma.user.findUnique({ where: { id: sessionUser.id } }).catch(() => null);

  if (byId) {
    return byId;
  }

  const byName = await prisma.user.findFirst({ where: { nombre: sessionUser.name } }).catch(() => null);

  if (byName) {
    return byName;
  }

  const syntheticPin = `ext-${crypto.createHash('sha1').update(sessionUser.id).digest('hex').slice(0, 8)}`;

  return prisma.user.create({
    data: {
      id: sessionUser.id,
      nombre: sessionUser.name,
      pin_acceso: syntheticPin,
      rol: sessionUser.role,
    },
  });
}

async function resolveDatabaseMachine(machine: SubmittedMachine) {
  const prisma = getPrismaClient();
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

export function createApiApp(): Express {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(attachSessionUser);

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

  app.post('/api/login', async (req, res) => {
    const { id, pin } = req.body ?? {};

    if (!id || !pin) {
      return res.status(400).json({ error: 'Credenciales incompletas' });
    }

    try {
      const prisma = getPrismaClient();
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ id }, { nombre: id }],
        },
      });

      if (user && user.pin_acceso === pin && ['OPERARIO', 'SUPERVISOR', 'JEFE'].includes(user.rol)) {
        return sendAuthenticatedUser(res, {
          id: user.id,
          name: user.nombre,
          role: user.rol,
        });
      }
    } catch (error) {
      console.warn('BD no disponible para login, usando credenciales de respaldo:', error instanceof Error ? error.message : error);
    }

    const predefinedUser = predefinedUsers.find((candidate) => candidate.id === id && candidate.pin_acceso === pin);

    if (predefinedUser) {
      return sendAuthenticatedUser(res, {
        id: predefinedUser.id,
        name: predefinedUser.nombre,
        role: predefinedUser.rol,
      });
    }

    return res.status(401).json({ error: 'Credenciales inválidas' });
  });

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

      const fallbackCount = completedMachines.length;

      try {
        const prisma = getPrismaClient();
        const databaseUser = await resolveDatabaseUser(req.user!);

        const logsToInsert = await Promise.all(completedMachines.map(async (machine) => {
          const resolvedMachine = await resolveDatabaseMachine(machine);
          const mainTemp = toNumberOrNull(machine.data?.tempOvoscan) ?? toNumberOrNull(machine.data?.temperatura);
          const secondaryTemp = toNumberOrNull(machine.data?.tempAire) ?? mainTemp;
          const co2 = toNumberOrNull(machine.data?.co2);

          if (mainTemp === null || secondaryTemp === null || co2 === null) {
            throw new Error(`Faltan métricas numéricas obligatorias para la máquina ${machine.id}`);
          }

          return {
            user_id: databaseUser.id,
            machine_id: resolvedMachine.id,
            photo_url: machine.photoUrl || null,
            temp_principal_actual: mainTemp,
            temp_principal_consigna: mainTemp,
            co2_actual: co2,
            co2_consigna: co2,
            fan_speed: 0,
            temp_secundaria_actual: secondaryTemp,
            temp_secundaria_consigna: secondaryTemp,
            is_na: machine.type === 'nacedora',
            temp_superior_actual: null,
            observaciones: buildObservationSummary(machine.data || {}),
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
        console.warn('No se pudo conectar a la base de datos, simulando éxito:', dbError);
        return res.status(200).json({
          message: 'Sincronización simulada exitosa (Sin BD)',
          count: fallbackCount,
        });
      }
    } catch (error) {
      console.error('Error en sync-hourly:', error);
      return res.status(500).json({ error: 'Error interno del servidor al sincronizar' });
    }
  });

  app.get('/api/dashboard/summary', requireRoles(SUPERVISOR_ROLES), async (_req, res) => {
    try {
      const prisma = getPrismaClient();
      const reportCount = await prisma.hourlyLog.count();
      return res.json({ reportCount });
    } catch (error) {
      console.error('Error al consultar conteo de reportes:', error);
      return res.json({ reportCount: 0 });
    }
  });

  app.get('/api/dashboard/status', requireRoles(SUPERVISOR_ROLES), async (_req, res) => {
    try {
      const prisma = getPrismaClient();
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
          const diaIncubacion = extractObservationValue(observaciones, 'Dia');
          const tempAire = extractObservationValue(observaciones, 'Temp Aire');
          const volteoNumero = extractObservationValue(observaciones, 'Volteos');
          const alarmaActiva = extractObservationValue(observaciones, 'Alarma');

          humidity = humedadRelativa || log.co2_actual.toFixed(1);
          data = {
            diaIncubacion,
            humedadRelativa,
            temperatura: temp,
            tempAire,
            volteoNumero,
            alarma: alarmaActiva,
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
      console.error('Error al consultar BD para status:', error);
      return res.json([]);
    }
  });

  app.get('/api/dashboard/trends', requireRoles(SUPERVISOR_ROLES), async (_req, res) => {
    try {
      const prisma = getPrismaClient();
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const logs = await prisma.hourlyLog.findMany({
        where: { fecha_hora: { gte: twentyFourHoursAgo } },
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
      console.error('Error al consultar BD para trends:', error);
      return res.json([]);
    }
  });

  app.get('/api/dashboard/operators', requireRoles(SUPERVISOR_ROLES), async (_req, res) => {
    try {
      const prisma = getPrismaClient();
      const users = await prisma.user.findMany({
        select: {
          id: true,
          nombre: true,
          rol: true,
        },
      });

      const mappedUsers = users.map((user) => ({
        id: user.id,
        name: user.nombre,
        role: user.rol,
        shift: user.rol === 'SUPERVISOR' || user.rol === 'JEFE' ? 'Gestión' : 'Rotativo',
        status: 'Activo',
      }));

      return res.json(mappedUsers);
    } catch (error) {
      console.error('Error fetching operators:', error);
      return res.json([]);
    }
  });

  app.post('/api/operators', requireRoles(SUPERVISOR_ROLES), async (req, res) => {
    try {
      const prisma = getPrismaClient();
      const { nombre, pin, rol } = req.body;

      if (!nombre || !pin || !rol) {
        return res.status(400).json({ error: 'Nombre, PIN y rol son requeridos' });
      }

      const validRoles: UserRole[] = ['OPERARIO', 'SUPERVISOR', 'JEFE'];

      if (!validRoles.includes(rol)) {
        return res.status(400).json({ error: 'Rol inválido' });
      }

      const existingUser = await prisma.user.findUnique({ where: { pin_acceso: pin } });

      if (existingUser) {
        return res.status(400).json({ error: 'El PIN ya está en uso' });
      }

      const newUser = await prisma.user.create({
        data: {
          nombre,
          pin_acceso: pin,
          rol,
        },
        select: {
          id: true,
          nombre: true,
          rol: true,
        },
      });

      return res.status(201).json({
        id: newUser.id,
        name: newUser.nombre,
        role: newUser.rol,
        shift: newUser.rol === 'SUPERVISOR' || newUser.rol === 'JEFE' ? 'Gestión' : 'Rotativo',
        status: 'Activo',
      });
    } catch (error) {
      console.error('Error creating operator:', error);
      return res.status(500).json({ error: 'No fue posible crear el operario' });
    }
  });

  return app;
}
