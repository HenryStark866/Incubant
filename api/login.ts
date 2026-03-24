const SESSION_COOKIE_NAME = 'incubant_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

const fallbackUsers = [
  { id: 'admin', pin: '4753', user: { id: 'admin', name: 'Administrador', role: 'JEFE' } },
  { id: 'Elkin Cavadia', pin: '11168', user: { id: 'Elkin Cavadia', name: 'Elkin Cavadia', role: 'JEFE' } },
  { id: 'Juan Alejandro', pin: '1111', user: { id: 'Juan Alejandro', name: 'Juan Alejandro', role: 'OPERARIO' } },
  { id: 'Juan Suaza', pin: '2222', user: { id: 'Juan Suaza', name: 'Juan Suaza', role: 'OPERARIO' } },
  { id: 'Ferney Tabares', pin: '3333', user: { id: 'Ferney Tabares', name: 'Ferney Tabares', role: 'OPERARIO' } },
  { id: 'turnero', pin: '4444', user: { id: 'turnero', name: 'Turnero', role: 'OPERARIO' } },
  { id: 'Jhon Piedrahita', pin: 'jp2026', user: { id: 'Jhon Piedrahita', name: 'Jhon Piedrahita', role: 'SUPERVISOR' } },
];

function parseBody(body: unknown) {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as { id?: string; pin?: string };
    } catch {
      return {};
    }
  }

  return (body || {}) as { id?: string; pin?: string };
}

function buildCookie(token: string, maxAge: number) {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag}`;
}

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const body = parseBody(req.body);
  const user = fallbackUsers.find((entry) => entry.id === body.id && entry.pin === body.pin)?.user;

  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const token = JSON.stringify({
    ...user,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });

  res.setHeader('Set-Cookie', buildCookie(token, SESSION_MAX_AGE_SECONDS));
  return res.status(200).json({ user });
}
