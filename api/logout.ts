import { clearSessionCookie } from '../backend/serverlessAuth';

export default function handler(_req: any, res: any) {
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.status(204).end();
}
