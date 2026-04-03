import { Request, Response } from 'express';
import { analyzeIncubatorImage } from '../services/vision.service';
import { generateReportPDF, generateSummaryPDF } from '../services/pdf.service';
import type { PrismaClient } from '@prisma/client';

async function getPrisma(): Promise<PrismaClient> {
  const { PrismaClient } = await import('@prisma/client');
  return new PrismaClient();
}

type AuthenticatedRequest = Request & {
  user?: { id: string; name: string; role: string; shift?: string };
  file?: Express.Multer.File;
};

/**
 * Obtiene la hora actual en Colombia (UTC-5)
 */
function getBogotaDate(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc - 5 * 60 * 60 * 1000);
}


/**
 * Limpia nombre de usuario para archivo: minúsculas, sin espacios, sin caracteres especiales
 */
function cleanUserName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();
}

/**
 * Formatea fecha como DD/MM/YYYY para nombres de carpetas
 */
function formatDateFolder(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Formatea hora como HH:MM para nombres de archivo
 */
function formatTimeFile(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${min}`;
}

/**
 * POST /api/reports
 * Reporte por hora de una máquina individual.
 * 1. Recibe imagen del operario
 * 2. Analiza con Gemini Vision
 * 3. Sube foto → carpeta Fotos (fecha-hora-maquina-operador.jpg)
 * 4. Guarda Report en Supabase
 */
export const processMachineReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { machineId, reportData: reportDataRaw } = req.body;
    const file = req.file;
    const userId = req.user?.id;
    const userName = req.user?.name || 'Operario';
    const userShift = req.user?.shift || '';

    if (!machineId || !userId) {
      return res.status(400).json({ error: 'Faltan parámetros: machineId y sesión activa son requeridos.' });
    }

    if (!file) {
      return res.status(400).json({ error: 'No se adjuntó imagen de evidencia.' });
    }

    const bogotaDate = getBogotaDate();
    const dateFolder = formatDateFolder(bogotaDate);
    const timeStr = formatTimeFile(bogotaDate);
    const cleanName = cleanUserName(userName);

    // 1. Análisis de imagen con Gemini Vision
    let extractedData = { temperature: 0, humidity: 0, processStatus: 'SIN_LECTURA' };
    try {
      const base64Image = file.buffer.toString('base64');
      const aiResult = await analyzeIncubatorImage(base64Image, file.mimetype);
      extractedData = {
        temperature: aiResult.temperature ?? 0,
        humidity: aiResult.humidity ?? 0,
        processStatus: aiResult.processStatus
      };
    } catch (visionError) {
      console.warn('[Report Controller] Gemini Vision falló, usando datos manuales/defaults:', visionError);
    }

    // Mezclar con datos manuales (tienen prioridad)
    let finalData = { ...extractedData };
    if (reportDataRaw) {
      try {
        const manualOverrides = typeof reportDataRaw === 'string'
          ? JSON.parse(reportDataRaw)
          : reportDataRaw;
        finalData = { ...finalData, ...manualOverrides };
      } catch { /* ignorar si el JSON está malformado */ }
    }

    // 2. Subir foto → Supabase Storage
    let imageUrl = '';
    let storagePhotoError = '';
    try {
      const { uploadToSupabase } = await import('../services/supabase_storage.service');
      const photoResult = await uploadToSupabase(
        file.buffer, userName, 'photos', file.mimetype
      );
      imageUrl = photoResult.publicUrl;
      console.log(`[Storage] Foto subida OK: ${photoResult.fileName}`);
    } catch (storageError) {
      storagePhotoError = `Storage: ${storageError instanceof Error ? storageError.message : 'Error desconocido'}`;
      console.error('[Storage] ERROR subiendo foto:', storageError);
    }

    // 4. Guardar en la base de datos
    let savedReport = null;
    try {
      const prisma = await getPrisma();

      let machineNumber = 1;
      let dbType: 'INCUBADORA' | 'NACEDORA' = 'INCUBADORA';

      const match = machineId.match(/(inc|nac)-(\d+)/i);
      if (match) {
        dbType = match[1].toLowerCase() === 'inc' ? 'INCUBADORA' : 'NACEDORA';
        machineNumber = parseInt(match[2], 10);
      }

      let machine = await prisma.machine.findFirst({
        where: { tipo: dbType, numero_maquina: machineNumber }
      });
      if (!machine) {
        machine = await prisma.machine.create({
          data: { tipo: dbType, numero_maquina: machineNumber }
        });
      }

      const data = finalData as any;
      const calcDiff = (r?: any, s?: any) => Math.abs(Number(r || 0) - Number(s || 0));

      const isAlarm = calcDiff(data.tempOvoscanReal || data.tempSynchroReal, data.tempOvoscanSP || data.tempSynchroSP) >= 1.5 ||
        calcDiff(data.tempAireReal || data.temperaturaReal, data.tempAireSP || data.temperaturaSP) >= 1.5 ||
        calcDiff(data.humidityReal, data.humiditySP) >= 1.5;

      // Create Report entry (for evidence history)
      savedReport = await prisma.report.create({
        data: {
          machine_id: machine.id,
          user_id: userId,
          tempPrincipalReal: Number(data.tempOvoscanReal || data.tempSynchroReal) || 0,
          tempPrincipalSP: Number(data.tempOvoscanSP || data.tempSynchroSP) || 0,
          tempAireReal: Number(data.tempAireReal || data.temperaturaReal) || 0,
          tempAireSP: Number(data.tempAireSP || data.temperaturaSP) || 0,
          humidityReal: Number(data.humidityReal) || 0,
          humiditySP: Number(data.humiditySP) || 0,
          co2Real: Number(data.co2Real) || 0,
          co2SP: Number(data.co2SP) || 0,
          isAlarm: isAlarm,
          isClosingReport: false,
          observaciones: String(data.observaciones || ''),
          processStatus: String(isAlarm ? 'ALARMA' : 'NORMAL'),
          imageUrl,
          pdfUrl: '',
          temperature: Number(data.tempOvoscanReal || data.tempSynchroReal) || 0,
          humidity: Number(data.humidityReal) || 0,
        }
      });

      // ALSO create HourlyLog entry (THIS IS WHAT THE DASHBOARD READS IN REAL-TIME)
      await prisma.hourlyLog.create({
        data: {
          user_id: userId,
          machine_id: machine.id,
          photo_url: imageUrl,
          temp_principal_actual: Number(data.tempOvoscanReal || data.tempSynchroReal) || 0,
          temp_principal_consigna: Number(data.tempOvoscanSP || data.tempSynchroSP) || 0,
          co2_actual: Number(data.co2Real) || 0,
          co2_consigna: Number(data.co2SP) || 0,
          fan_speed: 0,
          temp_secundaria_actual: Number(data.tempAireReal || data.temperaturaReal) || 0,
          temp_secundaria_consigna: Number(data.tempAireSP || data.temperaturaSP) || 0,
          is_na: dbType === 'NACEDORA',
          observaciones: `Registro visual: ${data.observaciones || ''}`
        }
      });

      // 5. Trigger SSE Event to update Admin Dashboard IMMEDIATELY
      try {
        const { sendEventToAll } = await import('../services/event.service');
        sendEventToAll({ 
          type: 'NEW_REPORT', 
          message: `Nuevo reporte de ${machineId} (${userName})`, 
          timestamp: new Date().toISOString(),
          machineId: machine.id,
          status: isAlarm ? 'alarm' : 'ok'
        });
      } catch (sseErr) {
        console.warn('[SSE] Error sending notification:', sseErr);
      }

      await prisma.$disconnect();
    } catch (dbError) {
      console.error('[Report Controller] Error guardando en BD:', dbError);
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
      }
    });

  } catch (error) {
    console.error('[Report Controller] Error general:', error);
    return res.status(500).json({ error: 'Error interno al procesar el reporte.' });
  }
};

/**
 * GET /api/reports/closing/request
 * Genera el reporte de cierre en el servidor basado en los logs del turno actual.
 */
export const requestClosingReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name || 'Operario';
    const userShift = req.user?.shift || 'Turno';

    if (!userId) {
      return res.status(401).json({ error: 'Sesión no válida.' });
    }

    const prisma = await getPrisma();
    
    // 1. Obtener logs del turno actual (hoy)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const logs = await prisma.hourlyLog.findMany({
      where: {
        user_id: userId,
        fecha_hora: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        machine: true
      },
      orderBy: {
        fecha_hora: 'asc'
      }
    });

    if (logs.length === 0) {
      return res.status(200).json({ message: 'No hay registros para este turno. No se generará PDF.' });
    }

    // 2. Generar PDF Profesional (Landscape)
    const pdfBuffer = await generateSummaryPDF(userName, userShift, logs);

    // 3. Subir a Supabase Storage (Carpeta "reports")
    const { uploadToSupabase } = await import('../services/supabase_storage.service');
    
    const result = await uploadToSupabase(pdfBuffer, userName, 'reports', 'application/pdf');

    // 4. Registrar el reporte en la DB
    await prisma.report.create({
      data: {
        user_id: userId,
        machine_id: logs[0].machine_id, // Referencia una máquina del turno
        pdfUrl: result.publicUrl,
        isClosingReport: true,
        observaciones: `Reporte de cierre generado automáticamente para ${userName}.`,
      }
    });

    await prisma.$disconnect();

    return res.status(200).json({
      success: true,
      message: 'Reporte de cierre generado y guardado en la nube.',
      url: result.publicUrl
    });

  } catch (error) {
    console.error('[Report Controller] Error en requestClosingReport:', error);
    return res.status(500).json({ error: 'Fallo al generar el reporte de cierre.' });
  }
};

/**
 * GET /api/reports/history
 * Obtiene el historial en orden descendente.
 */
export const getHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const prisma = await getPrisma();

    // Obtener los logs incluyendo usuario y máquina
    const logs = await prisma.hourlyLog.findMany({
      orderBy: { fecha_hora: 'desc' },
      take: 200,
      include: {
        user: { select: { nombre: true, rol: true, turno: true } },
        machine: true
      }
    });

    // Obtener incidentes
    const incidents = await prisma.incident.findMany({
      orderBy: { fecha_hora: 'desc' },
      take: 100,
      include: {
        user: { select: { nombre: true, rol: true, turno: true } },
        machine: true
      }
    });

    await prisma.$disconnect();

    return res.status(200).json({ logs, incidents });
  } catch (error) {
    console.error('[Report Controller] Error al obtener el historial:', error);
    return res.status(500).json({ error: 'Error interno obteniendo historial' });
  }
};
