function parseBody(body: unknown) {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as { nombre?: string; rol?: string };
    } catch {
      return {};
    }
  }

  return (body || {}) as { nombre?: string; rol?: string };
}

function getUser(req: any) {
  const cookies = String(req.headers?.cookie || '').split(';').reduce<Record<string, string>>((acc, item) => {
    const [name, ...rest] = item.trim().split('=');
    if (name) {
      acc[name] = decodeURIComponent(rest.join('='));
    }
    return acc;
  }, {});

  if (!cookies.incubant_session) {
    return null;
  }

  try {
    const user = JSON.parse(cookies.incubant_session);
    return user.exp && user.exp > Date.now() ? user : null;
  } catch {
    return null;
  }
}

export default function handler(req: any, res: any) {
  const user = getUser(req);

  if (!user) {
    return res.status(401).json({ error: 'Sesión expirada o no autenticada' });
  }

  if (user.role !== 'JEFE' && user.role !== 'SUPERVISOR') {
    return res.status(403).json({ error: 'No tienes permisos para acceder a este recurso' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { nombre, rol } = parseBody(req.body);

  if (!nombre || !rol) {
    return res.status(400).json({ error: 'Nombre y rol son requeridos' });
  }

  return res.status(201).json({
    id: `temp-${Date.now()}`,
    name: nombre,
    role: rol,
    shift: rol === 'SUPERVISOR' || rol === 'JEFE' ? 'Gestión' : 'Rotativo',
    status: 'Activo',
    createdBy: user.name,
    temporary: true,
  });
}
