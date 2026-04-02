import { Request, Response } from 'express';
import { analyzeIncubatorImage } from '../services/vision.service';
import { generateReportPDF } from '../services/pdf.service';
import type { PrismaClient } from '@prisma/client';

async function getPrisma(): Promise<PrismaClient> {
  const { PrismaClient } = await import('@prisma/client');
  return new PrismaClient();
}

type AuthenticatedRequest = Request & {
  user?: { id: string; name: string; role: string; shift?: string };
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
 * 4. Genera PDF → carpeta Reportes por Hora (fecha-hora-maquina-operador.pdf)
 * 5. Guarda Report en Supabase
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

    // 3. Generar PDF → Subir a Supabase Storage
    let pdfUrl = '';
    let storagePdfError = '';
    try {
      const pdfBuffer = await generateReportPDF(
        { id: machineId, name: `Máquina ${machineId}` },
        { name: userName, shift: userShift },
        finalData,
        file.buffer
      );

      // Subir PDF a Supabase Storage
      const { uploadToSupabase } = await import('../services/supabase_storage.service');
      const pdfResult = await uploadToSupabase(
        pdfBuffer, userName, 'reports', 'application/pdf'
      );
      pdfUrl = pdfResult.publicUrl;
      console.log(`[Storage] PDF reporte por hora subido OK: ${pdfResult.fileName}`);
    } catch (pdfError) {
      storagePdfError = `Storage PDF: ${pdfError instanceof Error ? pdfError.message : 'Error desconocido'}`;
      console.error('[Storage] ERROR generando/subiendo PDF:', pdfError);
    }

    // 4. Guardar en la base de datos
    let savedReport = null;
    try {
      const prisma = await getPrisma();

      const [prefix, numberPart] = machineId.split('-');
      const machineNumber = parseInt(numberPart);
      const dbType = prefix === 'inc' ? 'INCUBADORA' : 'NACEDORA';

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
          pdfUrl,

          temperature: Number(data.tempOvoscanReal || data.tempSynchroReal) || 0,
          humidity: Number(data.humidityReal) || 0,
        }
      });

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
        pdfUrl,
        savedToDb: !!savedReport,
        warnings: [storagePhotoError, storagePdfError].filter(Boolean),
      }
    });

  } catch (error) {
    console.error('[Report Controller] Error general:', error);
    return res.status(500).json({ error: 'Error interno al procesar el reporte.' });
  }
};

/**
 * POST /api/reports/closing
 * Reporte de cierre de turno.
 * 1. Recibe PDF generado desde el frontend
 * 2. Sube PDF → Carpeta Cierres de Turno (fecha-hora-cierre-operador.pdf)
 * 3. Guarda Report en Supabase con isClosingReport=true
 */
export const processClosingReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const file = req.file;
    const userId = req.user?.id;
    const userName = req.user?.name || 'Operario';
    const userShift = req.user?.shift || '';

    if (!userId) {
      return res.status(400).json({ error: 'Sesión activa requerida.' });
    }

    if (!file) {
      return res.status(400).json({ error: 'No se adjuntó PDF de cierre.' });
    }

    const bogotaDate = getBogotaDate();
    const dateFolder = formatDateFolder(bogotaDate);
    const timeStr = formatTimeFile(bogotaDate);
    const cleanName = cleanUserName(userName);

    // Subir PDF → Supabase Storage
    let pdfUrl = '';
    try {
      const { uploadToSupabase } = await import('../services/supabase_storage.service');
      const pdfResult = await uploadToSupabase(
        file.buffer, userName, 'closing', 'application/pdf'
      );
      pdfUrl = pdfResult.publicUrl;
      console.log(`[Storage] PDF cierre de turno subido OK: ${pdfResult.fileName}`);
    } catch (storageError) {
      console.error('[Storage] ERROR subiendo cierre de turno:', storageError);
    }

    // Guardar en BD
    let savedReport = null;
    try {
      const prisma = await getPrisma();

      savedReport = await prisma.report.create({
        data: {
          user_id: userId,
          machine_id: '', // Cierre de turno no está ligado a una máquina específica
          isClosingReport: true,
          isAlarm: false,
          processStatus: 'CIERRE_TURNO',
          observaciones: `Cierre de turno - ${userShift} - ${userName}`,
          pdfUrl,
          temperature: 0,
          humidity: 0,
          tempPrincipalReal: 0,
          tempPrincipalSP: 0,
          tempAireReal: 0,
          tempAireSP: 0,
          humidityReal: 0,
          humiditySP: 0,
          co2Real: 0,
          co2SP: 0,
        }
      });

      await prisma.$disconnect();
    } catch (dbError) {
      console.error('[Report Controller] Error guardando cierre en BD:', dbError);
    }

    return res.status(201).json({
      success: true,
      message: 'Cierre de turno registrado exitosamente.',
      report: {
        isClosingReport: true,
        pdfUrl,
        savedToDb: !!savedReport,
      }
    });

  } catch (error) {
    console.error('[Report Controller] Error en cierre de turno:', error);
    return res.status(500).json({ error: 'Error interno al procesar cierre de turno.' });
  }
};
