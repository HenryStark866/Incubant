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

  return res.status(200).json([]);
}
