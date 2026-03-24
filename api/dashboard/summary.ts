import { requireSupervisor } from '../_lib/serverlessAuth';

export default function handler(req: any, res: any) {
  if (!requireSupervisor(req, res)) {
    return;
  }

  return res.status(200).json({ reportCount: 0 });
}
