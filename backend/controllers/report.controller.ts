import { Request, Response } from 'express';
import { analyzeIncubatorImage } from '../services/vision.service';
import { generateSummaryPDF, generateReportPDF } from '../services/pdf.service';

// ──────────────────────────────────────────────────────────────────────────────
// Singleton de Prisma: reutiliza el cliente global del proceso principal
// para no agotar el pool de conexiones con instancias descartables.
// ──────────────────────────────────────────────────────────────────────────────
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: import('@prisma/client').PrismaClient;
};

async function getPrisma() {
  if (!globalForPrisma.prisma) {
    const { PrismaClient } = await import('@prisma/client');
    const dbUrl = (process.env.DATABASE_URL || '').replace(/\r/g, '').trim();
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      datasources: { db: { url: dbUrl } },
    });
  }
  return globalForPrisma.prisma;
}

type AuthenticatedRequest = Request & {
  user?: { id: string; name: string; role: string; shift?: string };
  file?: Express.Multer.File;
};

// ──────────────────────────────────────────────────────────────────────────────
// Helpers de fecha en hora Colombia (UTC-5, sin horario de verano)
// ──────────────────────────────────────────────────────────────────────────────
function getBogotaDate(): Date {
  // Colombia es UTC-5 permanentemente
  const now = new Date();
  return new Date(now.getTime() - 5 * 60 * 60 * 1000);
}

/**
 * Retorna la medianoche Colombia como timestamp UTC.
 * Usado para filtros "hoy" que deben respetar la jornada laboral local.
 */
function getTodayBogotaMidnight(): Date {
  const bogota = getBogotaDate();
  // Poner a medianoche en Colombia equivale a: año/mes/día a las 05:00 UTC
  const d = new Date(Date.UTC(bogota.getUTCFullYear(), bogota.getUTCMonth(), bogota.getUTCDate()));
  return d;
}

function cleanUserName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/reports
// Reporte por hora de una máquina individual con imagen de evidencia.
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

    // 1. Análisis de imagen con Gemini Vision
    let extractedData: Record<string, any> = { temperature: 0, humidity: 0, processStatus: 'SIN_LECTURA' };
    try {
      const base64Image = file.buffer.toString('base64');
      const aiResult = await analyzeIncubatorImage(base64Image, file.mimetype);
      extractedData = {
        temperature: aiResult.temperature ?? 0,
        humidity: aiResult.humidity ?? 0,
        processStatus: aiResult.processStatus,
      };
    } catch (visionError) {
      console.warn('[Report] Gemini Vision falló, usando datos manuales:', visionError);
    }

    // Mezclar con datos manuales (tienen prioridad sobre Vision)
    let finalData: Record<string, any> = { ...extractedData };
    if (reportDataRaw) {
      try {
        const manual = typeof reportDataRaw === 'string' ? JSON.parse(reportDataRaw) : reportDataRaw;
        finalData = { ...finalData, ...manual };
      } catch { /* JSON malformado — ignorar */ }
    }

    // 2. Subir foto → Supabase Storage (carpeta de la máquina)
    let imageUrl = '';
    let storagePhotoError = '';
    try {
      const { uploadToSupabase } = await import('../services/supabase_storage.service');
      const photoResult = await uploadToSupabase(file.buffer, userName, 'photos', file.mimetype, machineId);
      imageUrl = photoResult.publicUrl;
      console.log(`[Storage] Foto subida: ${photoResult.fileName} → ${machineId}`);
    } catch (storageError) {
      storagePhotoError = storageError instanceof Error ? storageError.message : 'Error desconocido';
      console.error('[Storage] ERROR subiendo foto:', storageError);
    }

    // 3. Guardar en la base de datos
    let savedReport = null;
    try {
      const prisma = await getPrisma();

      // Resolución de máquina (Soporta B01, N01, INC-01, NAC-01, etc.)
      let dbType: 'INCUBADORA' | 'NACEDORA' = 'INCUBADORA';
      let machineNumber = 1;
      
      const match = machineId.match(/(inc|nac|b|n)[-:_]?(\d+)/i);
      if (match) {
        const prefix = match[1].toLowerCase();
        dbType = (prefix === 'nac' || prefix === 'n') ? 'NACEDORA' : 'INCUBADORA';
        machineNumber = parseInt(match[2], 10);
      }

      // Buscar máquina en la BD (todas tienen IDS como B01, N01)
      const targetId = (dbType === 'INCUBADORA' ? 'B' : 'N') + machineNumber.toString().padStart(2, '0');
      
      let machine = await prisma.machine.findFirst({ 
        where: { id: targetId } 
      });

      if (!machine) {
        // Fallback: buscar por tipo/numero si el ID no coincide exactamente
        machine = await prisma.machine.findFirst({ 
          where: { tipo: dbType, numero_maquina: machineNumber } 
        });
      }

      if (!machine) {
        // Si aún no existe, crearla
        machine = await prisma.machine.create({ 
          data: { 
            id: targetId,
            tipo: dbType, 
            numero_maquina: machineNumber 
          } 
        });
      }

      const d = finalData;
      const toNum = (v: any) => (v !== undefined && v !== null && v !== '' ? Number(String(v).replace(',', '.')) : 0);
      const calcDiff = (r: any, s: any) => Math.abs(toNum(r) - toNum(s));

      const tempPrincipalReal = toNum(d.tempOvoscanReal ?? d.tempSynchroReal);
      const tempPrincipalSP   = toNum(d.tempOvoscanSP  ?? d.tempSynchroSP);
      const tempAireReal      = toNum(d.tempAireReal   ?? d.temperaturaReal);
      const tempAireSP        = toNum(d.tempAireSP     ?? d.temperaturaSP);
      const humedadReal       = toNum(d.humedadReal    ?? d.humedadRelativa ?? d.humidity);
      const humedadSP         = toNum(d.humedadSP      ?? d.humiditySP);
      const co2Real           = toNum(d.co2Real        ?? d.co2);
      const co2SP             = toNum(d.co2SP);

      const isAlarm =
        calcDiff(tempPrincipalReal, tempPrincipalSP) >= 1.5 ||
        calcDiff(tempAireReal, tempAireSP)           >= 1.5 ||
        calcDiff(humedadReal, humedadSP)             >= 1.5;

      // Generar PDF individual del reporte
      let pdfUrl = '';
      try {
        const pdfBuffer = await generateReportPDF(
          { tipo: dbType, numero_maquina: machineNumber },
          { nombre: userName },
          {
            temperature: tempPrincipalReal,
            humidity: humedadReal,
            processStatus: isAlarm ? 'ALARMA' : 'NORMAL'
          },
          file.buffer
        );
        const { uploadToSupabase } = await import('../services/supabase_storage.service');
        const pdfResult = await uploadToSupabase(pdfBuffer, userName, 'reports', 'application/pdf');
        pdfUrl = pdfResult.publicUrl;
      } catch (pdfError) {
        console.warn('[Report] Error generando PDF individual:', pdfError);
      }

      // Report (para historial de evidencias)
      savedReport = await prisma.report.create({
        data: {
          machine_id:       machine.id,
          user_id:          userId,
          tempPrincipalReal,
          tempPrincipalSP,
          tempAireReal,
          tempAireSP,
          humidityReal:  humedadReal,
          humiditySP:    humedadSP,
          co2Real,
          co2SP,
          isAlarm,
          isClosingReport:  false,
          observaciones:    String(d.observaciones || ''),
          processStatus:    isAlarm ? 'ALARMA' : 'NORMAL',
          imageUrl,
          pdfUrl,
          temperature:      tempPrincipalReal,
          humidity:         humedadReal,
        },
      });

      // HourlyLog (lo que lee el dashboard en tiempo real)
      await prisma.hourlyLog.create({
        data: {
          user_id:                  userId,
          machine_id:               machine.id,
          photo_url:                imageUrl || null,
          temp_principal_actual:    tempPrincipalReal,
          temp_principal_consigna:  tempPrincipalSP,
          co2_actual:               co2Real,
          co2_consigna:             co2SP,
          humedad_actual:           humedadReal,      // ← campo dedicado
          humedad_consigna:         humedadSP,        // ← campo dedicado
          temp_secundaria_actual:   tempAireReal,
          temp_secundaria_consigna: tempAireSP,
          is_na:                    dbType === 'NACEDORA',
          observaciones:            d.observaciones ? String(d.observaciones).slice(0, 500) : null,
        },
      });

      // 4. Disparar SSE al panel del supervisor
      try {
        const { sendEventToAll } = await import('../services/event.service');
        sendEventToAll({
          type:      'NEW_REPORT',
          message:   `Nuevo reporte de ${machineId} (${userName})`,
          timestamp: new Date().toISOString(),
          machineId: machine.id,
          status:    isAlarm ? 'alarm' : 'ok',
        });
      } catch (sseErr) {
        console.warn('[SSE] Error enviando notificación:', sseErr);
      }

    } catch (dbError) {
      console.error('[Report] Error guardando en BD:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Error guardando el reporte en la base de datos.',
        error: dbError instanceof Error ? dbError.message : 'Error desconocido',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Reporte por hora procesado y almacenado.',
      report: {
        machineId,
        isAlarm: savedReport?.isAlarm || false,
        isClosingReport: false,
        imageUrl,
        warnings: [storagePhotoError].filter(Boolean),
      },
    });

  } catch (error) {
    console.error('[Report] Error general:', error);
    return res.status(500).json({ error: 'Error interno al procesar el reporte.' });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/reports/closing/request
// Genera el reporte de cierre basado en los logs del turno actual (hora Colombia).
// ──────────────────────────────────────────────────────────────────────────────
export const requestClosingReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId   = req.user?.id;
    const userName = req.user?.name || 'Operario';
    const userShift = req.user?.shift || 'Turno';

    if (!userId) {
      return res.status(401).json({ error: 'Sesión no válida.' });
    }

    const prisma = await getPrisma();

    // Rango "hoy" en hora Colombia
    const todayBogota = getTodayBogotaMidnight();
    const tomorrowBogota = new Date(todayBogota.getTime() + 24 * 60 * 60 * 1000);

    const logs = await prisma.hourlyLog.findMany({
      where: {
        user_id:   userId,
        fecha_hora: { gte: todayBogota, lt: tomorrowBogota },
      },
      include:  { machine: true },
      orderBy:  { fecha_hora: 'asc' },
    });

    if (logs.length === 0) {
      return res.status(200).json({ message: 'No hay registros para este turno. No se generará PDF.' });
    }

    // Generar PDF y subir a Supabase Storage
    const pdfBuffer = await generateSummaryPDF(userName, userShift, logs);

    const { uploadToSupabase } = await import('../services/supabase_storage.service');
    const result = await uploadToSupabase(pdfBuffer, userName, 'reports', 'application/pdf');

    // Registrar el reporte de cierre en la BD
    await prisma.report.create({
      data: {
        user_id:        userId,
        machine_id:     logs[0].machine_id,
        pdfUrl:         result.publicUrl,
        isClosingReport: true,
        observaciones:  `Reporte de cierre generado para ${userName} — ${logs.length} registros.`,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Reporte de cierre generado y guardado en la nube.',
      url:     result.publicUrl,
    });

  } catch (error) {
    console.error('[Report] Error en requestClosingReport:', error);
    return res.status(500).json({ error: 'Fallo al generar el reporte de cierre.' });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/reports/history
// Historial de HourlyLogs + Incidents para el panel admin.
// ──────────────────────────────────────────────────────────────────────────────
export const getHistory = async (_req: Request, res: Response) => {
  try {
    const prisma = await getPrisma();

    const [logs, incidents, reports] = await Promise.all([
      prisma.hourlyLog.findMany({
        orderBy: { fecha_hora: 'desc' },
        take: 200,
        include: {
          user:    { select: { nombre: true, rol: true, turno: true } },
          machine: true,
        },
      }),
      prisma.incident.findMany({
        orderBy: { fecha_hora: 'desc' },
        take: 100,
        include: {
          user:    { select: { nombre: true, rol: true, turno: true } },
          machine: true,
        },
      }),
      prisma.report.findMany({
        orderBy: { fecha_hora: 'desc' },
        take: 100,
        include: {
          user:    { select: { nombre: true, rol: true, turno: true } },
          machine: true,
        },
      }),
    ]);

    return res.status(200).json({ logs, incidents, reports });
  } catch (error) {
    console.error('[Report] Error obteniendo historial:', error);
    return res.status(500).json({ error: 'Error interno obteniendo historial' });
  }
};
