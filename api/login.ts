import { authenticateFallbackUser, createSessionCookie, parseRequestBody } from '../backend/serverlessAuth';

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const body = parseRequestBody<{ id?: string; pin?: string }>(req.body);
  const user = authenticateFallbackUser(body.id, body.pin);

  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  res.setHeader('Set-Cookie', createSessionCookie(user));
  return res.status(200).json({ user });
}
