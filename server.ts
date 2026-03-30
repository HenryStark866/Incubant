import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { createApiApp } from './backend/createApiApp';

async function startServer() {
  const app = createApiApp();
  const port = parseInt(process.env.PORT || '3000', 10);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

void startServer();
