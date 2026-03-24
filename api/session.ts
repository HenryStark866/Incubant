import { readSessionUser } from '../backend/serverlessAuth';

export default function handler(req: any, res: any) {
  const user = readSessionUser(req);

  if (!user) {
    return res.status(401).json({ error: 'No hay sesión activa' });
  }

  return res.status(200).json({ user });
}
