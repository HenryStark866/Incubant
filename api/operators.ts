import { parseRequestBody, requireSupervisor } from '../backend/serverlessAuth';

export default function handler(req: any, res: any) {
  const user = requireSupervisor(req, res);

  if (!user) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { nombre, rol } = parseRequestBody<{ nombre?: string; rol?: string }>(req.body);

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
