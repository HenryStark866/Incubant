import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { createApiApp } from './backend/createApiApp';

/**
 * Robust Express Server - Unified Incubant Monitor
 * Configures environment, CORS, API routes, and static serving.
 */
async function startServer() {
  const app = express();
  
  // 1. CORS Configuration (Robust & Unified)
  const allowedOrigins = [
    'https://incubantmonitor.vercel.app',
    process.env.VITE_DEV_URL || 'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
  }));

  // 2. Mandatory Health Check Endpoints (Standardized)
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      uptime: process.uptime(),
      timestamp: new Date().toISOString() 
    });
  });

  // Database connectivity health check
  app.get('/api/health-db', async (_req, res) => {
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();
      res.status(200).json({ 
        status: 'ok', 
        database: 'connected', 
        timestamp: new Date().toISOString() 
      });
    } catch (err: any) {
      console.error('[Health-DB] Connectivity failure:', err.message);
      res.status(503).json({ 
        status: 'error', 
        database: 'disconnected', 
        error: err.message,
        timestamp: new Date().toISOString() 
      });
    }
  });

  // 3. Initialize major API routing logic
  createApiApp(app);

  const port = Number(process.env.PORT) || 3001;

  // 4. Environment-specific routing
  if (process.env.NODE_ENV !== 'production') {
    // Development: Integrate Vite for HMR support
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Dev] Vite HMR middleware integrated.');
  } else {
    // Production: Serve static assets
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // Catch-all for SPA routes
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('[Prod] Serving static build from /dist.');
  }

  // 5. Server Execution
  const server = app.listen(port, '0.0.0.0', () => {
    console.log('==================================================');
    console.log(`🚀 INCUBANT MONITOR SERVER IS LIVE`);
    console.log(`Port:    ${port}`);
    console.log(`Mode:    ${process.env.NODE_ENV || 'development'}`);
    console.log(`Local:   http://localhost:${port}`);
    console.log('==================================================');
  });

  // 6. Graceful Shutdown
  const shutdown = () => {
    console.log('[Server] SIGTERM/SIGINT received. Closing HTTP server...');
    server.close(() => {
      console.log('[Server] HTTP server closed. Process exiting.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

void startServer().catch(err => {
  console.error('[Critical Error] Server failed to start:', err);
  process.exit(1);
});
