import crypto from 'crypto';

type UserRole = 'OPERARIO' | 'SUPERVISOR' | 'JEFE';

export type SessionUser = {
  id: string;
  name: string;
  role: UserRole;
};

type VercelRequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
  body?: any;
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: any) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

const SESSION_COOKIE_NAME = 'incubant_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const SESSION_SECRET = process.env.SESSION_SECRET || 'incubantmonitor-dev-session-secret';

const fallbackUsers: Array<{ id: string; pin: string; user: SessionUser }> = [
  { id: 'admin', pin: '4753', user: { id: 'admin', name: 'Administrador', role: 'JEFE' } },
  { id: 'Elkin Cavadia', pin: '11168', user: { id: 'Elkin Cavadia', name: 'Elkin Cavadia', role: 'JEFE' } },
  { id: 'Juan Alejandro', pin: '1111', user: { id: 'Juan Alejandro', name: 'Juan Alejandro', role: 'OPERARIO' } },
  { id: 'Juan Suaza', pin: '2222', user: { id: 'Juan Suaza', name: 'Juan Suaza', role: 'OPERARIO' } },
  { id: 'Ferney Tabares', pin: '3333', user: { id: 'Ferney Tabares', name: 'Ferney Tabares', role: 'OPERARIO' } },
  { id: 'turnero', pin: '4444', user: { id: 'turnero', name: 'Turnero', role: 'OPERARIO' } },
  { id: 'Jhon Piedrahita', pin: 'jp2026', user: { id: 'Jhon Piedrahita', name: 'Jhon Piedrahita', role: 'SUPERVISOR' } },
];

export function authenticateFallbackUser(id?: string, pin?: string) {
  if (!id || !pin) {
    return null;
  }

  return fallbackUsers.find((entry) => entry.id === id && entry.pin === pin)?.user || null;
}

export function parseRequestBody<T>(body: unknown): T {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as T;
    } catch {
      return {} as T;
    }
  }

  return (body || {}) as T;
}

export function canAccessSupervisor(role?: UserRole | null) {
  return role === 'JEFE' || role === 'SUPERVISOR';
}

function getHeaderCookie(req: VercelRequestLike) {
  const cookieHeader = req.headers?.cookie;
  return Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader || '';
}

function parseCookies(cookieHeader: string) {
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, item) => {
    const [name, ...rest] = item.trim().split('=');
    if (!name) {
      return acc;
    }

    acc[name] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function signPayload(payload: string) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
}

function buildCookie(token: string, maxAge: number) {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag}`;
}

export function createSessionCookie(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({
    ...user,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  })).toString('base64url');

  return buildCookie(`${payload}.${signPayload(payload)}`, SESSION_MAX_AGE_SECONDS);
}

export function clearSessionCookie() {
  return buildCookie('', 0);
}

export function readSessionUser(req: VercelRequestLike): SessionUser | null {
  const cookies = parseCookies(getHeaderCookie(req));
  const token = cookies[SESSION_COOKIE_NAME];

  if (!token) {
    return null;
  }

  const [payload, signature] = token.split('.');

  if (!payload || !signature || signature !== signPayload(payload)) {
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

export function requireSession(req: VercelRequestLike, res: VercelResponseLike) {
  const user = readSessionUser(req);

  if (!user) {
    res.status(401).json({ error: 'Sesión expirada o no autenticada' });
    return null;
  }

  return user;
}

export function requireSupervisor(req: VercelRequestLike, res: VercelResponseLike) {
  const user = requireSession(req, res);

  if (!user) {
    return null;
  }

  if (!canAccessSupervisor(user.role)) {
    res.status(403).json({ error: 'No tienes permisos para acceder a este recurso' });
    return null;
  }

  return user;
}
