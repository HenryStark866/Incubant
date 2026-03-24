import { canAccessSupervisor } from '../backend/serverlessAuth';

export default function handler(_req: any, res: any) {
  res.status(200).json({ ok: true, supervisorRule: canAccessSupervisor('JEFE') });
}
