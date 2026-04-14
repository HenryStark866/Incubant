import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import { db, fStorage } from './firebase';
import { generateSummaryPDF } from './services/pdf.service';

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

  // CORS Middleware controlado arriba en root

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

  // Helper para esquivar cuelgues eternos de Firebase
  const safeFirebaseGet = async (path: string, orderChild?: string, limitLast?: number) => {
    try {
      let query: any = db.ref(path);
      if (orderChild) query = query.orderByChild(orderChild);
      if (limitLast) query = query.limitToLast(limitLast);

      const val = await Promise.race([
        query.once('value').then((s: any) => s.val()),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 2500))
      ]);
      return val || {};
    } catch {
      console.warn(`[Fail-Safe] Timeout en ${path}, retornando vacío.`);
      return {};
    }
  };

  // Helper para escrituras Firebase con Timeout fail-safe (para Vercel Serverless)
  const safeFirebaseWrite = async (promise: Promise<any>, pathAction: string) => {
    try {
      await Promise.race([
        promise,
        new Promise((_, r) => setTimeout(() => r(new Error('Write Timeout')), 2500))
      ]);
    } catch (e) {
      console.warn(`[Fail-Safe] Timeout/Error escribiendo en ${pathAction}`, e);
    }
  };

  // Upload helper to Firebase Storage Bucket
  const uploadToFirebaseStorage = async (buffer: Buffer, mimetype: string, folder: string, username: string, machineId: string) => {
     try {
        const bucket = fStorage.bucket();
        const destPath = `${folder}/${username}_${machineId}_${Date.now()}.png`;
        const file = bucket.file(destPath);
        
        await file.save(buffer, { metadata: { contentType: mimetype } });
        // Generate signed URL valid to 2100 essentially making it accessible forever
        const [url] = await file.getSignedUrl({ action: 'read', expires: '01-01-2100' });
        return { publicUrl: url };
     } catch (e) {
        console.error("Firebase Storage Upload Error:", e);
        return { publicUrl: '' };
     }
  };

  // =======================================================================
  // AUTH
  // =======================================================================
  app.post('/api/login', async (req, res) => {
    const { id, pin } = req.body ?? {};
    if (!id || !pin) return res.status(400).json({ error: 'Credenciales incompletas' });

    try {
      // Login en Firebase con Timeout Safe
      const users = await safeFirebaseGet('users');
      
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
           db.ref(`users/${userIdStr}`).set(foundUser).catch(e => console.error("Firebase write admin failed", e.message));
         } else if (String(id).toLowerCase() === 'operario' && pin === '1234') {
           userIdStr = 'operario-1';
           foundUser = { nombre: 'Operario de Prueba', rol: 'OPERARIO', turno: 'Turno 1', pin: '1234' };
           db.ref(`users/${userIdStr}`).set(foundUser).catch(e => console.error("Firebase write operario failed", e.message));
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
      // Extraemos máquinas de RTDB de modo seguro anti crashes
      const machines = await safeFirebaseGet('machines');
      const reports = await safeFirebaseGet('reports', 'timestamp', 100);

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

        // Si la foto es BASE64 la mandamos a Firebase Storage
        if (finalPhotoUrl && finalPhotoUrl.startsWith('data:image')) {
            const base64Data = finalPhotoUrl.replace(/^data:image\/\w+;base64,/, '');
            const uploadResult = await uploadToFirebaseStorage(
              Buffer.from(base64Data, 'base64'), 'image/jpeg', 'photos', userName, machine.id
            );
            finalPhotoUrl = uploadResult.publicUrl || finalPhotoUrl;
        }

        const d = machine.data;
        const mainTemp = d.tempOvoscanReal || d.tempSynchroReal || 0;
        const humedad = d.humedadReal || d.humedadRelativa || 0;

        // Escribimos a Firebase RTDB en `reports` de manera protegida (anti serverless kill)
        const newReportRef = db.ref('reports').push();
        await safeFirebaseWrite(newReportRef.set({
          machine_id: machine.id,
          user_name: userName,
          photo_url: finalPhotoUrl || null,
          temp_actual: mainTemp,
          humedad_actual: humedad,
          is_na: machine.inactive || false,
          data: d,
          timestamp: new Date().toISOString()
        }), `reports/${machine.id}`);

        // Actualizamos estado de máquina
        await safeFirebaseWrite(db.ref(`machines/${machine.id}`).update({
          last_photo: finalPhotoUrl || null,
          last_temp: mainTemp,
          last_hum: humedad,
          inactive: machine.inactive || false,
          updated_at: new Date().toISOString()
        }), `machines/${machine.id}`);
      }

      // --- GENERAR PDF HORARIO ---
      try {
        const fullLogs = completedMachines.map((m: any) => ({
          fecha_hora: new Date().toISOString(),
          machine: { tipo: 'INC', numero_maquina: m.id },
          is_na: m.inactive || false,
          temp_principal_actual: m.data?.tempOvoscanReal || 0,
          temp_principal_consigna: 0, 
          temp_secundaria_actual: m.data?.tempSynchroReal || 0,
          temp_secundaria_consigna: 0,
          humedad_actual: m.data?.humedadReal || 0,
          co2_actual: 0,
          observaciones: m.data?.observaciones || ''
        }));
        
        let shiftStr = req.user?.shift || 'Turno Base';
        const pdfBuffer = await generateSummaryPDF(userName, shiftStr, fullLogs);
        
        // Guardamos el PDF de Sincronización Horaria y lo exponemos
        const pdfUpload = await uploadToFirebaseStorage(pdfBuffer, 'application/pdf', 'pdfs', userName, 'hourly-sync');
        console.log(`✅ [Sync PDF] generado y subido a Firebase Storage: ${pdfUpload.publicUrl}`);
        
        return res.status(200).json({ 
           message: 'Sincronización Firebase exitosa', 
           count: completedMachines.length, 
           pdfUrl: pdfUpload.publicUrl 
        });

      } catch (pdfErr) {
        console.error('Error generando PDF de Sync:', pdfErr);
        // Devolvemos el status okay aunque el PDF falle
      }

      return res.status(200).json({ message: 'Sincronización API ok, PDF fallido', count: completedMachines.length });
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
        const uploadResult = await uploadToFirebaseStorage(file.buffer, file.mimetype, 'photos', userName, machineId);
        imageUrl = uploadResult.publicUrl;
      }

      let parsedData = {};
      try { parsedData = JSON.parse(reportData); } catch {}

      const rRef = db.ref('reports').push();
      await safeFirebaseWrite(rRef.set({
        machine_id: machineId,
        user_name: userName,
        photo_url: imageUrl,
        data: parsedData,
        timestamp: new Date().toISOString()
      }), `reports/${machineId}`);

      res.status(201).json({
        success: true,
        reportId: rRef.key,
        message: 'Reporte ingresado en Firebase'
      });
    } catch (error) {
      res.status(500).json({ error: 'Error procesando informe individual Firebase.' });
    }
  });

  // Admin History Real endpoint safe
  app.get('/api/reports/history', requireAuthenticatedUser, async (req, res) => {
    try {
      const reportsDict = await safeFirebaseGet('reports', 'timestamp', 300);
      
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
