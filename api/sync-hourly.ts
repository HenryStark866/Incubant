import { parseRequestBody, requireSession } from './_lib/serverlessAuth';

export default function handler(req: any, res: any) {
  const user = requireSession(req, res);

  if (!user) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const body = parseRequestBody<{ machines?: any[] }>(req.body);
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
