export default function handler(_req: any, res: any) {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `incubant_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`);
  res.status(204).end();
}
