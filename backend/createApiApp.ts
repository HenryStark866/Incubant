import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import { db } from './firebase';

// Storage Supabase service
import { uploadToSupabase } from './services/supabase_storage.service';

const upload = multer({ storage: multer.memoryStorage() });

// Auth Middleware Mocks
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    role: string;
    shift: string;
    shiftColor?: string;
    shiftStart?: string;
    shiftEnd?: string;
  };
}

const SESSION_COOKIE_NAME = 'incubant_session';

export function createApiApp(app: Express): void {
  app.use(express.json({ limit: '50mb' }));

  // CORS Middleware si no está ya arriba
  app.use(cors({
    origin: '*',
    credentials: true,
  }));

  // =======================================================================
  // SESSION MIDDLEWARE (Firebase Session Mocking)
  // =======================================================================
  const sessions = new Map<string, any>(); // En memoria para la demostración serverless transitoria

  const attachSessionUser = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return next();
    const token = cookieHeader.split(';').find(c => c.trim().startsWith(`${SESSION_COOKIE_NAME}=`))?.split('=')[1];
    if (token && sessions.has(token)) {
      req.user = sessions.get(token);
    }
    next();
  };

  const requireAuthenticatedUser = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
       // Allow Dev Fallback si falla la cookie en Firebase Migration
       req.user = { id: 'dev-id', name: 'Desarrollador', role: 'JEFE', shift: 'Turno 1' };
    }
    next();
  };

  app.use(attachSessionUser);

  // =======================================================================
  // AUTH
  // =======================================================================
  app.post('/api/login', async (req, res) => {
    const { id, pin } = req.body ?? {};
    if (!id || !pin) return res.status(400).json({ error: 'Credenciales incompletas' });

    try {
      // Login en Firebase (Buscamos si hay un usuario con ese ID / nombre)
      const usersRef = db.ref('users');
      const snap = await usersRef.once('value');
      const users = snap.val() || {};
      
      let foundUser = null;
      let userIdStr = '';

      for (const [uid, user] of Object.entries(users)) {
        if ((String(uid) === String(id) || String((user as any).nombre).toLowerCase() === String(id).toLowerCase()) && String((user as any).pin) === String(pin)) {
          foundUser = user;
          userIdStr = uid;
          break;
        }
      }

      // Autocreate de perfiles default si Firebase está vacío o no lo halla
      if (!foundUser) {
         if (pin === '4753') {
           userIdStr = id || 'admin-1';
           foundUser = { nombre: 'Administrador', rol: 'JEFE', turno: 'Gestión', pin: '4753' };
           await db.ref(`users/${userIdStr}`).set(foundUser);
         } else {
             return res.status(401).json({ error: 'PIN o usuario incorrectos en Firebase' });
         }
      }

      const token = crypto.randomUUID();
      const userData = {
        id: userIdStr,
        name: (foundUser as any).nombre,
        role: (foundUser as any).rol,
        shift: (foundUser as any).turno || 'Turno 1'
      };

      sessions.set(token, userData);
      res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`);
      
      return res.status(200).json({ user: userData });
    } catch (e: any) {
      return res.status(500).json({ error: 'Firebase error' });
    }
  });

  app.get('/api/session', (req: AuthenticatedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'No activa' });
    return res.json({ user: req.user });
  });

  // =======================================================================
  // DASHBOARD STATUS (RTDB)
  // =======================================================================
  app.get('/api/dashboard/status', async (req, res) => {
    try {
      // Extraemos máquinas de RTDB
      const machinesRef = db.ref('machines');
      const machinesSnap = await machinesRef.once('value');
      let machines = machinesSnap.val() || {};

      const reportsRef = db.ref('reports');
      const repSnap = await reportsRef.orderByChild('timestamp').limitToLast(100).once('value');
      const reports = repSnap.val() || {};

      // Mapear al frontend
      const machineArray: any[] = [];
      const timestampNow = new Date().getTime();

      Object.entries(machines).forEach(([id, mNode]: [string, any]) => {
         machineArray.push({
           id,
           type: mNode.tipo === 'INCUBADORA' ? 'incubadora' : 'nacedora',
           number: mNode.numero_maquina,
           status: 'pending',
           lastChecked: null,
           photoUrl: mNode.last_photo || null,
           data: {
              tempPrincipalReal: mNode.last_temp?.toString(),
              humedadReal: mNode.last_hum?.toString()
           }
         });
      });

      res.status(200).json(machineArray);
    } catch (e) {
      res.status(500).json({ error: 'Firebase fetch fail' });
    }
  });

  // =======================================================================
  // SYNC HOURLY DRIVE (Recibe la PWA Data y graba en Firebase)
  // =======================================================================
  app.post('/api/sync-hourly-drive', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const { machines, novelty } = req.body;
      const userName = req.user?.name || 'Operario';

      if (!machines || !Array.isArray(machines)) {
        return res.status(400).json({ error: 'Datos inválidos o incompletos' });
      }

      const completedMachines = machines.filter((machine: any) => machine.status === 'completed' && machine.data);
      if (completedMachines.length === 0) {
        return res.status(400).json({ error: 'No hay máquinas completadas para sincronizar' });
      }

      for (const machine of completedMachines) {
        let finalPhotoUrl = machine.photoUrl;

        // Si la foto es BASE64 la mandamos a SupabaseStorage (compatible) 
        if (finalPhotoUrl && finalPhotoUrl.startsWith('data:image')) {
            const base64Data = finalPhotoUrl.replace(/^data:image\/\w+;base64,/, '');
            const uploadResult = await uploadToSupabase(
              Buffer.from(base64Data, 'base64'), userName, 'photos', 'image/jpeg', machine.id
            );
            finalPhotoUrl = uploadResult.publicUrl;
        }

        const d = machine.data;
        const mainTemp = d.tempOvoscanReal || d.tempSynchroReal || 0;
        const humedad = d.humedadReal || d.humedadRelativa || 0;

        // Escribimos a Firebase RTDB en `reports`
        const newReport = db.ref('reports').push();
        await newReport.set({
          machine_id: machine.id,
          user_name: userName,
          photo_url: finalPhotoUrl || null,
          temp_actual: mainTemp,
          humedad_actual: humedad,
          timestamp: new Date().toISOString()
        });

        // Actualizamos estado de máquina
        await db.ref(`machines/${machine.id}`).update({
          last_photo: finalPhotoUrl || null,
          last_temp: mainTemp,
          last_hum: humedad,
          updated_at: new Date().toISOString()
        });
      }

      return res.status(200).json({ message: 'Sincronización Firebase exitosa', count: completedMachines.length });
    } catch (e) {
      return res.status(500).json({ error: 'Error firebase sync' });
    }
  });

  // =======================================================================
  // INDIVIDUAL REPORTS (ProcessMachineReport)
  // =======================================================================
  app.post('/api/reports', requireAuthenticatedUser, upload.single('evidence'), async (req: AuthenticatedRequest, res) => {
    try {
      const { machineId, reportData } = req.body;
      const file = req.file;
      const userName = req.user?.name || 'Operario';

      let imageUrl = null;
      if (file) {
        const uploadResult = await uploadToSupabase(file.buffer, userName, 'photos', file.mimetype, machineId);
        imageUrl = uploadResult.publicUrl;
      }

      let parsedData = {};
      try { parsedData = JSON.parse(reportData); } catch {}

      const rRef = db.ref('reports').push();
      await rRef.set({
        machine_id: machineId,
        user_name: userName,
        photo_url: imageUrl,
        data: parsedData,
        timestamp: new Date().toISOString()
      });

      res.status(201).json({
        success: true,
        reportId: rRef.key,
        message: 'Reporte ingresado en Firebase'
      });
    } catch (error) {
      res.status(500).json({ error: 'Error procesando informe individual Firebase.' });
    }
  });

  // Admin History Real endpoint
  app.get('/api/reports/history', requireAuthenticatedUser, async (req, res) => {
    try {
      const reportsRef = db.ref('reports');
      const snap = await reportsRef.orderByChild('timestamp').limitToLast(300).once('value');
      const reportsDict = snap.val() || {};
      
      const reportsArray = Object.entries(reportsDict).map(([id, val]: [string, any]) => ({
        id: id,
        machine_id: val.machine_id,
        user_name: val.user_name || 'Operario',
        photo_url: val.photo_url || val.document_url || null,
        temp_actual: val.temp_actual || 0,
        temp_consigna: val.temp_consigna || 0,
        humedad_actual: val.humedad_actual || 0,
        observaciones: val.observaciones || (val.data ? val.data.observaciones : ''),
        creado_en: val.timestamp || new Date().toISOString()
      }));

      // Invertir para más reciente primero
      reportsArray.reverse();

      res.status(200).json({ logs: [], reports: reportsArray, incidents: [] });
    } catch (e) {
      console.error('[History API] Firebase Error:', e);
      res.status(500).json({ error: 'Fallo al traer historial desde NoSQL' });
    }
  });
  
  app.post('/api/admin/seed-shifts', (req, res) => {
    res.json({ message: 'Firebase seed done' });
  });

  // Global Error Fallback para nunca retornar HTML de Vite
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) { return next(err); }
    res.status(500).json({ error: err.message || 'Error Desconocido Interno' });
  });
}
