function parseCookies(cookieHeader?: string) {
  return (cookieHeader || '').split(';').reduce<Record<string, string>>((acc, item) => {
    const [name, ...rest] = item.trim().split('=');
    if (!name) {
      return acc;
    }

    acc[name] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

export default function handler(req: any, res: any) {
  const cookies = parseCookies(req.headers?.cookie);
  const rawUser = cookies.incubant_session;

  if (!rawUser) {
    return res.status(401).json({ error: 'No hay sesión activa' });
  }

  try {
    const user = JSON.parse(rawUser);

    if (!user.exp || user.exp < Date.now()) {
      return res.status(401).json({ error: 'No hay sesión activa' });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });
  } catch {
    return res.status(401).json({ error: 'No hay sesión activa' });
  }
}
