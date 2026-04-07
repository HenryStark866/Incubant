import { type Response } from 'express';
import { getPrismaClient as getPrisma } from '../createApiApp';
import { analyzeIncubatorImage } from '../services/vision.service';
import { generateReportPDF, generateSummaryPDF } from '../services/pdf.service';
import { uploadToSupabase } from '../services/supabase_storage.service';

// Tipos locales para evitar dependencias circulares
type AuthenticatedRequest = any; 

// Obtener fecha hoy en Bogotá para reportes de cierre
function getTodayBogotaMidnight() {
  const now = new Date();
  const bogotaOffset = -5 * 60; // UTC-5
  const localTime = now.getTime() + (now.getTimezoneOffset() + bogotaOffset) * 60000;
  const bogotaDate = new Date(localTime);
  bogotaDate.setHours(0, 0, 0, 0);
  return bogotaDate;
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/reports
// Reporte por hora de una máquina - OPTIMIZADO PARA EVITAR TIMEOUTS
// ──────────────────────────────────────────────────────────────────────────────
export const processMachineReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { machineId, reportData: reportDataRaw } = req.body;
    const file = req.file;
    const userId = req.user?.id;
    const userName = req.user?.name || 'Operario';

    if (!machineId || !userId) {
      return res.status(400).json({ error: 'Faltan parámetros: machineId y sesión activa son requeridos.' });
    }

    if (!file) {
      return res.status(400).json({ error: 'No se adjuntó imagen de evidencia.' });
    }

    console.log(`[Report] Iniciando procesamiento rápido para ${machineId}...`);

    // 1 & 2. IA y Foto en PARALELO
    const base64Image = file.buffer.toString('base64');
    const [aiSettled, photoSettled] = await Promise.allSettled([
      analyzeIncubatorImage(base64Image, file.mimetype),
      uploadToSupabase(file.buffer, userName, 'photos', file.mimetype, machineId)
    ]);

    let extractedData: Record<string, any> = { temperature: 0, humidity: 0 };
    if (aiSettled.status === 'fulfilled') {
      extractedData = {
        temperature: aiSettled.value.temperature ?? 0,
        humidity: aiSettled.value.humidity ?? 0,
      };
    }

    let imageUrl = '';
    if (photoSettled.status === 'fulfilled') {
      imageUrl = photoSettled.value.publicUrl;
    }

    // Mezclar con datos manuales
    let finalData = { ...extractedData };
    if (reportDataRaw) {
      try {
        const manual = typeof reportDataRaw === 'string' ? JSON.parse(reportDataRaw) : reportDataRaw;
        finalData = { ...finalData, ...manual };
      } catch { /* ignore */ }
    }

    // 3. Preparación de datos y BD
    const prisma = await getPrisma();
    let dbType: 'INCUBADORA' | 'NACEDORA' = 'INCUBADORA';
    let machineNumber = 1;
    
    // Extraer tipo y número del machineId enviado (ej: "inc-1" o "INC-01")
    const match = machineId.match(/(inc|nac|b|n)[-:_]?(\d+)/i);
    if (match) {
      const prefix = match[1].toLowerCase();
      dbType = (prefix === 'nac' || prefix === 'n') ? 'NACEDORA' : 'INCUBADORA';
      machineNumber = parseInt(match[2], 10);
    }

    // Buscar máquina por la restricción única [tipo, numero_maquina]
    // Esto garantiza que usemos las máquinas existentes (generalmente con UUIDs)
    let machine = await prisma.machine.findUnique({
      where: {
        tipo_numero_maquina: {
          tipo: dbType,
          numero_maquina: machineNumber
        }
      }
    });

    if (!machine) {
      // Fallback: Si no existe, la creamos (aquí sí podemos proponer un ID amigable si queremos, pero mejor dejar que UUID actúe si no hay ID)
      // Sin embargo, para consistencia con el dashboard, intentamos crearla con el ID esperado si no hay colisión
      const fallbackId = (dbType === 'INCUBADORA' ? 'B' : 'N') + machineNumber.toString().padStart(2, '0');
      try {
        machine = await prisma.machine.create({
          data: {
            id: fallbackId,
            tipo: dbType,
            numero_maquina: machineNumber
          }
        });
      } catch {
        // Si falla por ID duplicado, volvemos a buscar (redundancia de seguridad)
        machine = await prisma.machine.findFirst({
          where: { tipo: dbType, numero_maquina: machineNumber }
        });
      }
    }

    if (!machine) {
      throw new Error(`No se pudo identificar ni crear la máquina: ${machineId}`);
    }

    const d = finalData;
    const toNum = (v: any) => (v !== undefined && v !== null && v !== '' ? Number(String(v).replace(',', '.')) : 0);
    const calcDiff = (r: any, s: any) => Math.abs(toNum(r) - toNum(s));

    const tempPrincipalReal = toNum(d.tempOvoscanReal ?? d.tempSynchroReal);
    const tempPrincipalSP   = toNum(d.tempOvoscanSP  ?? d.tempSynchroSP);
    const humidityReal      = toNum(d.humedadReal    ?? d.humedadRelativa ?? d.humidity);
    const humiditySP        = toNum(d.humedadSP);
    const tempAireReal      = toNum(d.tempAireReal);
    const tempAireSP        = toNum(d.tempAireSP);

    const isAlarm =
      calcDiff(tempPrincipalReal, tempPrincipalSP) >= 1.5 ||
      calcDiff(humidityReal, humiditySP) >= 2.0;

    // 4. PERSISTENCIA INICIAL (SIN PDF)
    const [savedReport] = await prisma.$transaction([
      prisma.report.create({
        data: {
          machine_id:       machine.id,
          user_id:          userId,
          tempPrincipalReal,
          tempPrincipalSP,
          humidityReal,
          humiditySP,
          tempAireReal,
          tempAireSP,
          co2Real:          toNum(d.co2Real),
          co2SP:            toNum(d.co2SP),
          isAlarm,
          processStatus:    isAlarm ? 'ALARMA' : 'NORMAL',
          imageUrl,
          temperature:      tempPrincipalReal, // Alias legacy
          humidity:         humidityReal,      // Alias legacy
          observaciones:    String(d.observaciones || ''),
        },
      }),
      prisma.hourlyLog.create({
        data: {
          user_id:                  userId,
          machine_id:               machine.id,
          photo_url:                imageUrl || null,
          temp_principal_actual:    tempPrincipalReal,
          temp_principal_consigna:  tempPrincipalSP,
          humedad_actual:           humidityReal,
          humedad_consigna:         humiditySP,
          co2_actual:               toNum(d.co2Real),
          co2_consigna:             toNum(d.co2SP),
          temp_secundaria_actual:   tempAireReal,
          temp_secundaria_consigna: tempAireSP,
          is_na:                    dbType === 'NACEDORA',
          observaciones:            d.observaciones ? String(d.observaciones).slice(0, 500) : null,
        },
      })
    ]);

    // 5. RESPUESTA INMEDIATA AL CLIENTE (Evita timeouts de 30s)
    res.status(201).json({
      success: true,
      reportId: savedReport.id,
      message: 'Reporte recibido y datos guardados. El PDF se generará en breve.'
    });

    // 6. NOTIFICACIÓN INMEDIATA (SSE) - Para refrescar contadores en el Admin
    void (async () => {
      try {
        const { sendEventToAll } = await import('../services/event.service');
        sendEventToAll({
          type:      'NEW_REPORT',
          message:   `Reporte de ${machineId} (${userName}) recibido.`,
          timestamp: new Date().toISOString(),
          machineId: machine.id,
          status:    isAlarm ? 'alarm' : 'ok',
        });
        
        // También marcar al usuario como activo de inmediato
        sendEventToAll({ 
          type: 'USER_STATUS_UPDATE', 
          message: `${userName} reportó máquina ${machineId}`,
          userId: userId 
        });
      } catch (e) {
        console.warn('[Report SSE] Error en notificación inicial:', e);
      }
    })();

    // 7. PROCESAMIENTO DIFERIDO (Background - Generación de PDF)
    void (async () => {
      try {
        // A. Generar PDF
        const pdfBuffer = await generateReportPDF(
          { tipo: dbType, numero_maquina: machineNumber },
          { nombre: userName },
          { temperature: tempPrincipalReal, humidity: humidityReal, processStatus: isAlarm ? 'ALARMA' : 'NORMAL' },
          file.buffer
        );
        const pdfResult = await uploadToSupabase(pdfBuffer, userName, 'reports', 'application/pdf');
        
        // B. Actualizar registro con pdfUrl
        await prisma.report.update({
          where: { id: savedReport.id },
          data: { pdfUrl: pdfResult.publicUrl }
        });
      } catch (bgError) {
        console.error('[Report Background] Error post-procesamiento:', bgError);
      }
    })();


  } catch (error) {
    console.error('[Report] Error crítico:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Fallo al procesar el reporte. Intente de nuevo.' });
    }
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/reports/closing/request
// ──────────────────────────────────────────────────────────────────────────────
export const requestClosingReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId   = req.user?.id;
    const userName = req.user?.name || 'Operario';
    const userShift = req.user?.shift || 'Turno';

    if (!userId) return res.status(401).json({ error: 'No autorizado.' });

    const prisma = await getPrisma();
    const today = getTodayBogotaMidnight();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const logs = await prisma.hourlyLog.findMany({
      where: { user_id: userId, fecha_hora: { gte: today, lt: tomorrow } },
      include: { machine: true },
      orderBy: { fecha_hora: 'asc' },
    });

    if (logs.length === 0) return res.status(200).json({ message: 'Sin registros hoy.' });

    const pdfBuffer = await generateSummaryPDF(userName, userShift, logs);
    const result = await uploadToSupabase(pdfBuffer, userName, 'reports', 'application/pdf');

    await prisma.report.create({
      data: {
        user_id: userId,
        machine_id: logs[0].machine_id,
        pdfUrl: result.publicUrl,
        isClosingReport: true,
        observaciones: `Reporte de cierre (${logs.length} registros).`,
      },
    });

    return res.status(200).json({ success: true, url: result.publicUrl });
  } catch (error) {
    console.error('[Closing Report] Error:', error);
    return res.status(500).json({ error: 'Error en reporte de cierre.' });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/reports/history
// Unified history mapping Report.imageUrl -> photo_url
// ──────────────────────────────────────────────────────────────────────────────
export const getHistory = async (_req: any, res: Response) => {
  try {
    const prisma = await getPrisma();
    const [rawLogs, incidents, rawReports] = await Promise.all([
      prisma.hourlyLog.findMany({
        orderBy: { fecha_hora: 'desc' },
        take: 200,
        include: { user: { select: { nombre: true } }, machine: true },
      }),
      prisma.incident.findMany({
        orderBy: { fecha_hora: 'desc' },
        take: 100,
        include: { user: { select: { nombre: true } }, machine: true },
      }),
      prisma.report.findMany({
        orderBy: { fecha_hora: 'desc' },
        take: 100,
        include: { user: { select: { nombre: true } }, machine: true },
      }),
    ]);

    // Asegurar que las URLs vacías sean null para evitar lógica falsy incorrecta en el frontend
    const reports = rawReports.map(r => ({
      ...r,
      photo_url: (r.imageUrl && r.imageUrl.trim() !== '') ? r.imageUrl : null,
      pdfUrl: (r.pdfUrl && r.pdfUrl.trim() !== '') ? r.pdfUrl : null
    }));

    const logs = rawLogs.map(l => ({
      ...l,
      photo_url: (l.photo_url && l.photo_url.trim() !== '') ? l.photo_url : null
    }));

    return res.status(200).json({ logs, incidents, reports });
  } catch (error) {
    console.error('[History] Error:', error);
    return res.status(500).json({ error: 'Error cargando historial.' });
  }
};
