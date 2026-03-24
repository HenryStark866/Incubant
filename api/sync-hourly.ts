function parseBody(body: unknown) {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as { machines?: any[] };
    } catch {
      return {};
    }
  }

  return (body || {}) as { machines?: any[] };
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const body = parseBody(req.body);
  const machines = Array.isArray(body.machines) ? body.machines : [];
  const completedMachines = machines.filter((machine: any) => machine.status === 'completed' && machine.data);

  if (completedMachines.length === 0) {
    return res.status(400).json({ error: 'No hay máquinas completadas para sincronizar' });
  }

  return res.status(200).json({
    message: `Sincronización simulada exitosa para ${user.name}`,
    count: completedMachines.length,
  });
}
