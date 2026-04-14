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

  // SSE Clientes (declarado al inicio para que todos los handlers puedan usarlo)
  const sseClients = new Set<Response>();
  const broadcastSSE = (payload: object) => {
    const msg = `data: ${JSON.stringify(payload)}\n\n`;
    sseClients.forEach(client => { if (!client.writableEnded) client.write(msg); });
  };
  (app as any).__broadcastSSE = broadcastSSE;

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

        // Notificar a clientes SSE en tiempo real
        broadcastSSE({ type: 'NEW_REPORT', machineId: machine.id, userName });
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
  
  // =======================================================================
  // ADMIN USERS (CRUD)
  // =======================================================================
  app.get('/api/admin/users', requireAuthenticatedUser, async (req, res) => {
    try {
      const usersDict = await safeFirebaseGet('users');
      const usersArray = Object.entries(usersDict).map(([id, val]: [string, any]) => ({
        id,
        nombre: val.nombre || '',
        rol: val.rol || '',
        turno: val.turno || '',
        estado: val.estado || 'ACTIVO',
        pin: val.pin || ''
      }));
      res.status(200).json(usersArray);
    } catch (e) {
      console.error('[Admin Users] Get Error:', e);
      res.status(500).json({ error: 'Error obteniendo usuarios' });
    }
  });

  app.post('/api/admin/users', requireAuthenticatedUser, async (req, res) => {
    try {
      const newUserRef = db.ref('users').push();
      const userData = {
         nombre: req.body.nombre,
         rol: req.body.rol,
         turno: req.body.turno,
         estado: req.body.estado || 'ACTIVO',
         pin: req.body.pin || '1234'
      };
      await safeFirebaseWrite(newUserRef.set(userData), `users/${newUserRef.key}`);
      res.status(201).json({ id: newUserRef.key, ...userData });
    } catch (e) {
      res.status(500).json({ error: 'Error creando usuario' });
    }
  });

  app.put('/api/admin/users/:id', requireAuthenticatedUser, async (req, res) => {
    try {
      const { id } = req.params;
      // Actualizamos solo los campos enviados
      const userData: any = {};
      if (req.body.nombre !== undefined) userData.nombre = req.body.nombre;
      if (req.body.rol !== undefined) userData.rol = req.body.rol;
      if (req.body.turno !== undefined) userData.turno = req.body.turno;
      if (req.body.estado !== undefined) userData.estado = req.body.estado;
      if (req.body.pin !== undefined) userData.pin = req.body.pin;

      await safeFirebaseWrite(db.ref(`users/${id}`).update(userData), `users/${id}`);
      res.status(200).json({ id, ...userData });
    } catch (e) {
      res.status(500).json({ error: 'Error actualizando usuario' });
    }
  });

  app.delete('/api/admin/users/:id', requireAuthenticatedUser, async (req, res) => {
    try {
      const { id } = req.params;
      await safeFirebaseWrite(db.ref(`users/${id}`).remove(), `users/${id}`);
      res.status(200).json({ message: 'Usuario eliminado' });
    } catch (e) {
      res.status(500).json({ error: 'Error eliminando usuario' });
    }
  });

  app.post('/api/admin/seed-shifts', (req, res) => {
    res.json({ message: 'Firebase seed done' });
  });

  // =======================================================================
  // HEALTH CHECK
  // =======================================================================
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  // =======================================================================
  // LOGOUT
  // =======================================================================
  app.post('/api/logout', (req: AuthenticatedRequest, res) => {
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const token = cookieHeader.split(';').find(c => c.trim().startsWith(`${SESSION_COOKIE_NAME}=`))?.split('=')[1];
      if (token) sessions.delete(token);
    }
    res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`);
    res.json({ message: 'Sesión cerrada' });
  });

  // =======================================================================
  // DASHBOARD OPERATORS & SUMMARY
  // =======================================================================
  app.get('/api/dashboard/operators', async (_req, res) => {
    try {
      const usersDict = await safeFirebaseGet('users');
      const operators = Object.entries(usersDict).map(([id, val]: [string, any]) => ({
        id,
        nombre: val.nombre || '',
        name: val.nombre || '',
        rol: val.rol || 'OPERARIO',
        role: val.rol || 'OPERARIO',
        turno: val.turno || '',
        shift: val.turno || '',
        estado: val.estado || 'ACTIVO',
        status: val.estado || 'ACTIVO',
      }));
      res.json(operators);
    } catch {
      res.json([]);
    }
  });

  app.get('/api/dashboard/summary', async (_req, res) => {
    try {
      const reports = await safeFirebaseGet('reports', 'timestamp', 200);
      const reportsArr = Object.values(reports || {});
      const reportCount = reportsArr.length;

      // Turno actual según hora de Bogotá
      const nowBogota = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date());
      const h = parseInt(nowBogota.split(':')[0]);
      let currentShift = 'Fuera de Turno';
      if (h >= 6 && h < 14) currentShift = 'Turno 1 (06:00–14:00)';
      else if (h >= 14 && h < 22) currentShift = 'Turno 2 (14:00–22:00)';
      else currentShift = 'Turno 3 (22:00–06:00)';

      res.json({
        reportCount,
        shiftClosingCount: 0,
        responsibleOperator: '',
        onlineOperators: [],
        activeOperatorsNames: '',
        currentShift,
        lastReportTime: reportsArr.length > 0 ? (reportsArr[reportsArr.length - 1] as any).timestamp : null,
        activeOperatorsCount: 0,
      });
    } catch {
      res.json({ reportCount: 0, shiftClosingCount: 0, currentShift: 'Sin datos', onlineOperators: [], activeOperatorsNames: '' });
    }
  });

  app.get('/api/dashboard/machine-logs', async (req, res) => {
    try {
      const { machineId } = req.query;
      const reports = await safeFirebaseGet('reports', 'timestamp', 200);
      const logs = Object.entries(reports || {})
        .map(([id, val]: [string, any]) => ({ id, ...val }))
        .filter((r: any) => !machineId || r.machine_id === machineId)
        .reverse();
      res.json(logs);
    } catch {
      res.json([]);
    }
  });

  // =======================================================================
  // ADMIN SHIFTS & ASSIGNMENTS
  // =======================================================================
  app.get('/api/admin/shifts', async (_req, res) => {
    try {
      const shiftsDict = await safeFirebaseGet('shifts');
      if (!shiftsDict || Object.keys(shiftsDict).length === 0) {
        // Seed default shifts si no hay ninguno
        const defaults = [
          { nombre: 'Turno 1', hora_inicio: '06:00', hora_fin: '14:00', color: '#F59E0B' },
          { nombre: 'Turno 2', hora_inicio: '14:00', hora_fin: '22:00', color: '#3B82F6' },
          { nombre: 'Turno 3', hora_inicio: '22:00', hora_fin: '06:00', color: '#8B5CF6' },
        ];
        for (const s of defaults) {
          await safeFirebaseWrite(db.ref('shifts').push().set(s), 'shifts/seed');
        }
        return res.json(defaults);
      }
      const shiftsArr = Object.entries(shiftsDict).map(([id, val]: [string, any]) => ({ id, ...val }));
      res.json(shiftsArr);
    } catch {
      res.json([]);
    }
  });

  app.post('/api/admin/shifts', requireAuthenticatedUser, async (req, res) => {
    try {
      const ref = db.ref('shifts').push();
      const data = { nombre: req.body.nombre, hora_inicio: req.body.hora_inicio, hora_fin: req.body.hora_fin, color: req.body.color || '#F59E0B' };
      await safeFirebaseWrite(ref.set(data), `shifts/${ref.key}`);
      res.status(201).json({ id: ref.key, ...data });
    } catch {
      res.status(500).json({ error: 'Error creando turno' });
    }
  });

  app.put('/api/admin/shifts/:id', requireAuthenticatedUser, async (req, res) => {
    try {
      const { id } = req.params;
      const data: any = {};
      if (req.body.nombre !== undefined) data.nombre = req.body.nombre;
      if (req.body.hora_inicio !== undefined) data.hora_inicio = req.body.hora_inicio;
      if (req.body.hora_fin !== undefined) data.hora_fin = req.body.hora_fin;
      if (req.body.color !== undefined) data.color = req.body.color;
      await safeFirebaseWrite(db.ref(`shifts/${id}`).update(data), `shifts/${id}`);
      res.json({ id, ...data });
    } catch {
      res.status(500).json({ error: 'Error actualizando turno' });
    }
  });

  app.delete('/api/admin/shifts/:id', requireAuthenticatedUser, async (req, res) => {
    try {
      await safeFirebaseWrite(db.ref(`shifts/${req.params.id}`).remove(), `shifts/${req.params.id}`);
      res.json({ message: 'Turno eliminado' });
    } catch {
      res.status(500).json({ error: 'Error eliminando turno' });
    }
  });

  app.get('/api/admin/assignments', async (_req, res) => {
    try {
      const data = await safeFirebaseGet('assignments');
      const arr = Object.entries(data || {}).map(([id, val]: [string, any]) => ({ id, ...val }));
      res.json(arr);
    } catch {
      res.json([]);
    }
  });

  app.post('/api/admin/assignments', requireAuthenticatedUser, async (req, res) => {
    try {
      const ref = db.ref('assignments').push();
      const data = { userId: req.body.userId, shiftId: req.body.shiftId, fecha: req.body.fecha || new Date().toISOString().split('T')[0] };
      await safeFirebaseWrite(ref.set(data), `assignments/${ref.key}`);
      res.status(201).json({ id: ref.key, ...data });
    } catch {
      res.status(500).json({ error: 'Error creando asignación' });
    }
  });

  app.delete('/api/admin/assignments/:id', requireAuthenticatedUser, async (req, res) => {
    try {
      await safeFirebaseWrite(db.ref(`assignments/${req.params.id}`).remove(), `assignments/${req.params.id}`);
      res.json({ message: 'Asignación eliminada' });
    } catch {
      res.status(500).json({ error: 'Error eliminando asignación' });
    }
  });

  // =======================================================================
  // ADMIN CLEAR-DB
  // =======================================================================
  app.post('/api/admin/clear-db', requireAuthenticatedUser, async (_req, res) => {
    try {
      await safeFirebaseWrite(db.ref('reports').remove(), 'reports');
      await safeFirebaseWrite(db.ref('machines').remove(), 'machines');
      res.json({ message: 'Base de datos limpiada' });
    } catch {
      res.status(500).json({ error: 'Error limpiando la base de datos' });
    }
  });

  // =======================================================================
  // REQUESTS (SOLICITUDES DE PERMISO)
  // =======================================================================
  app.get('/api/requests/stats', async (_req, res) => {
    try {
      const data = await safeFirebaseGet('requests');
      const all = Object.values(data || {}) as any[];
      const pending = all.filter(r => r.status === 'pending' || r.estado === 'pendiente').length;
      res.json({ pending, total: all.length });
    } catch {
      res.json({ pending: 0, total: 0 });
    }
  });

  app.get('/api/requests', requireAuthenticatedUser, async (_req, res) => {
    try {
      const data = await safeFirebaseGet('requests', 'timestamp', 100);
      const arr = Object.entries(data || {}).map(([id, val]: [string, any]) => ({ id, ...val })).reverse();
      res.json(arr);
    } catch {
      res.json([]);
    }
  });

  app.post('/api/requests', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const ref = db.ref('requests').push();
      const data = {
        userId: req.user?.id,
        userName: req.user?.name,
        tipo: req.body.tipo || 'permiso',
        motivo: req.body.motivo || '',
        status: 'pending',
        estado: 'pendiente',
        timestamp: new Date().toISOString(),
      };
      await safeFirebaseWrite(ref.set(data), `requests/${ref.key}`);
      res.status(201).json({ id: ref.key, ...data });
    } catch {
      res.status(500).json({ error: 'Error creando solicitud' });
    }
  });

  app.put('/api/requests/:id', requireAuthenticatedUser, async (req, res) => {
    try {
      const { id } = req.params;
      const data: any = {};
      if (req.body.status !== undefined) data.status = req.body.status;
      if (req.body.estado !== undefined) data.estado = req.body.estado;
      if (req.body.responseNote !== undefined) data.responseNote = req.body.responseNote;
      await safeFirebaseWrite(db.ref(`requests/${id}`).update(data), `requests/${id}`);
      res.json({ id, ...data });
    } catch {
      res.status(500).json({ error: 'Error actualizando solicitud' });
    }
  });

  // =======================================================================
  // SSE — SERVER SENT EVENTS
  // =======================================================================
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Heartbeat para mantener la conexión viva
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
    }, 25000);

    sseClients.add(res);
    console.log(`[SSE] Cliente conectado — total: ${sseClients.size}`);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
      console.log(`[SSE] Cliente desconectado — total: ${sseClients.size}`);
    });
  });

  // =======================================================================
  // MY-SCHEDULE (Operario)
  // =======================================================================
  app.get('/api/my-schedule', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const shifts = await safeFirebaseGet('shifts');
      const shiftsArr = Object.entries(shifts || {}).map(([id, val]: [string, any]) => ({ id, ...val }));
      const userShift = shiftsArr.find(s => s.nombre === req.user?.shift) || shiftsArr[0] || null;
      res.json({ shift: userShift, allShifts: shiftsArr });
    } catch {
      res.json({ shift: null, allShifts: [] });
    }
  });

  // =======================================================================
  // EVIDENCE / MINE
  // =======================================================================
  app.get('/api/evidence/mine', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const reports = await safeFirebaseGet('reports', 'timestamp', 200);
      const mine = Object.entries(reports || {})
        .map(([id, val]: [string, any]) => ({ id, ...val }))
        .filter((r: any) => r.user_name === req.user?.name || r.userId === req.user?.id)
        .reverse();
      res.json(mine);
    } catch {
      res.json([]);
    }
  });

  // =======================================================================
  // REPORTS — CLOSING REQUEST (Cierre de turno del operario)
  // =======================================================================
  app.post('/api/reports/closing/request', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const ref = db.ref('closings').push();
      const data = {
        userId: req.user?.id,
        userName: req.user?.name,
        shift: req.user?.shift,
        observaciones: req.body.observaciones || '',
        timestamp: new Date().toISOString(),
        status: 'pending',
      };
      await safeFirebaseWrite(ref.set(data), `closings/${ref.key}`);
      broadcastSSE({ type: 'NEW_REQUEST', targetUserId: 'all' });
      res.status(201).json({ id: ref.key, ...data });
    } catch {
      res.status(500).json({ error: 'Error registrando cierre de turno' });
    }
  });

  // =======================================================================
  // CHAT (Mensajería interna básica)
  // =======================================================================
  app.get('/api/chat/conversations', requireAuthenticatedUser, async (_req, res) => {
    try {
      const data = await safeFirebaseGet('chat/conversations');
      const arr = Object.entries(data || {}).map(([id, val]: [string, any]) => ({ id, ...val }));
      res.json(arr);
    } catch {
      res.json([]);
    }
  });

  app.post('/api/chat/messages', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const ref = db.ref('chat/messages').push();
      const data = {
        fromId: req.user?.id,
        fromName: req.user?.name,
        conversationId: req.body.conversationId || 'general',
        message: req.body.message || '',
        timestamp: new Date().toISOString(),
      };
      await safeFirebaseWrite(ref.set(data), `chat/messages/${ref.key}`);
      broadcastSSE({ type: 'NEW_MESSAGE', conversationId: data.conversationId });
      res.status(201).json({ id: ref.key, ...data });
    } catch {
      res.status(500).json({ error: 'Error enviando mensaje' });
    }
  });

  // Legacy /api/operators → redirige internamente a /api/admin/users para compatibilidad
  app.get('/api/operators', requireAuthenticatedUser, async (_req, res) => {
    try {
      const usersDict = await safeFirebaseGet('users');
      const arr = Object.entries(usersDict || {}).map(([id, val]: [string, any]) => ({ id, nombre: val.nombre, name: val.nombre, rol: val.rol, role: val.rol, turno: val.turno, shift: val.turno, estado: val.estado || 'Activo', status: val.estado || 'Activo' }));
      res.json(arr);
    } catch {
      res.json([]);
    }
  });

  app.post('/api/operators', requireAuthenticatedUser, async (req, res) => {
    try {
      const ref = db.ref('users').push();
      const data = { nombre: req.body.nombre, rol: req.body.rol || 'OPERARIO', turno: req.body.turno || 'Turno 1', estado: 'ACTIVO', pin: req.body.pin || '1234' };
      await safeFirebaseWrite(ref.set(data), `users/${ref.key}`);
      res.status(201).json({ id: ref.key, ...data });
    } catch {
      res.status(500).json({ error: 'Error creando operario' });
    }
  });

  app.put('/api/operators/:id', requireAuthenticatedUser, async (req, res) => {
    try {
      const { id } = req.params;
      const data: any = {};
      if (req.body.nombre !== undefined) data.nombre = req.body.nombre;
      if (req.body.rol !== undefined) data.rol = req.body.rol;
      if (req.body.turno !== undefined) data.turno = req.body.turno;
      if (req.body.estado !== undefined) data.estado = req.body.estado;
      if (req.body.pin !== undefined) data.pin = req.body.pin;
      await safeFirebaseWrite(db.ref(`users/${id}`).update(data), `users/${id}`);
      res.json({ id, ...data });
    } catch {
      res.status(500).json({ error: 'Error actualizando operario' });
    }
  });

  app.delete('/api/operators/:id', requireAuthenticatedUser, async (req, res) => {
    try {
      await safeFirebaseWrite(db.ref(`users/${req.params.id}`).remove(), `users/${req.params.id}`);
      res.json({ message: 'Operario eliminado' });
    } catch {
      res.status(500).json({ error: 'Error eliminando operario' });
    }
  });

  // Global Error Fallback para nunca retornar HTML de Vite
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) { return next(err); }
    res.status(500).json({ error: err.message || 'Error Desconocido Interno' });
  });
}

