import { createApiApp } from '../backend/createApiApp';

const app = createApiApp();

export default function handler(req: any, res: any) {
  return app(req, res);
}
