import { Request, Response } from 'express';
import { analyzeIncubatorImage } from '../services/vision.service';
import { uploadToDrive } from '../services/drive.service';
import { generateReportPDF } from '../services/pdf.service';
import type { PrismaClient } from '@prisma/client';

// Importar Prisma lazily para que funcione en el contexto de backend Render
async function getPrisma(): Promise<PrismaClient> {
  const { PrismaClient } = await import('@prisma/client');
  return new PrismaClient();
}

type AuthenticatedRequest = Request & {
  user?: { id: string; name: string; role: string; shift?: string };
};

/**
 * POST /api/reports
 * Orquesta el flujo completo:
 * 1. Recibe imagen (multipart/form-data) del operario
 * 2. Analiza con Gemini Vision (temperatura °F, humedad, estado)
 * 3. Sube foto a Google Drive 
 * 4. Genera PDF de respaldo y lo sube a Google Drive
 * 5. Guarda Report en Supabase (Prisma)
 * 6. Responde con el resumen completo al frontend
 */
export const processMachineReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { machineId, reportData: reportDataRaw } = req.body;
    const file = req.file;
    const userId = req.user?.id;

    if (!machineId || !userId) {
      return res.status(400).json({ error: 'Faltan parámetros: machineId y sesión activa son requeridos.' });
    }

    if (!file) {
      return res.status(400).json({ error: 'No se adjuntó imagen de evidencia.' });
    }

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

    // Mezclar con datos manuales enviados desde el frontend (tienen prioridad)
    let finalData = { ...extractedData };
    if (reportDataRaw) {
      try {
        const manualOverrides = typeof reportDataRaw === 'string' 
          ? JSON.parse(reportDataRaw) 
          : reportDataRaw;
        finalData = { ...finalData, ...manualOverrides };
      } catch { /* ignorar si el JSON está malformado */ }
    }

    // 2. Subir foto de evidencia a Google Drive (carpeta: Fotos)
    let imageUrl = '';
    try {
      const folderIdPhotos = process.env.DRIVE_FOLDER_PHOTOS_ID;
      if (!folderIdPhotos) throw new Error('DRIVE_FOLDER_PHOTOS_ID no está configurada en las variables de entorno.');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const userName = (req.user?.name || 'Operario').replace(/\s+/g, '_');
      const photoName = `Foto_${machineId}_${timestamp}_${userName}.jpg`;
      const driveResult = await uploadToDrive(file.buffer, photoName, file.mimetype, folderIdPhotos);
      imageUrl = driveResult.publicUrl ?? '';
      console.log(`[Drive] Foto subida OK: ${photoName}`);
    } catch (driveError) {
      console.error('[Drive] ERROR subiendo foto:', driveError);
      // Continuamos — la foto fallida no debe bloquear guardar el reporte
    }

    // 3. Generar PDF y subirlo a Drive (carpeta: Reportes por hora)
    let pdfUrl = '';
    try {
      const folderIdReports = process.env.DRIVE_FOLDER_REPORTS_ID;
      if (!folderIdReports) throw new Error('DRIVE_FOLDER_REPORTS_ID no está configurada en las variables de entorno.');

      const pdfBuffer = await generateReportPDF(
        { id: machineId, name: `Máquina ${machineId}` },
        { name: req.user?.name || 'Operario', shift: req.user?.shift },
        finalData,
        file.buffer
      );
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const userName = (req.user?.name || 'Operario').replace(/\s+/g, '_');
      const pdfName = `Reporte_${machineId}_${timestamp}_${userName}.pdf`;
      const pdfResult = await uploadToDrive(pdfBuffer, pdfName, 'application/pdf', folderIdReports);
      pdfUrl = pdfResult.publicUrl ?? '';
      console.log(`[Drive] PDF subido OK: ${pdfName}`);
    } catch (pdfError) {
      console.error('[Drive] ERROR generando/subiendo PDF:', pdfError);
    }

    // 4. Guardar en la base de datos (Supabase via Prisma)
    let savedReport = null;
    try {
      const prisma = await getPrisma();
      
      // Resolver o crear la máquina en la base de datos
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

      // Calcular si es alarma (por si el frontend no envió el flag o para validación doble)
      const data = finalData as any;
      const calcDiff = (r?: any, s?: any) => Math.abs(Number(r || 0) - Number(s || 0));
      
      const isAlarm = calcDiff(data.tempOvoscanReal || data.tempSynchroReal, data.tempOvoscanSP || data.tempSynchroSP) >= 1.5 ||
                      calcDiff(data.tempAireReal || data.temperaturaReal, data.tempAireSP || data.temperaturaSP) >= 1.5 ||
                      calcDiff(data.humidityReal, data.humiditySP) >= 1.5;

      // Crear el reporte
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
          observaciones: String(data.observaciones || ""),
          processStatus: String(isAlarm ? "ALARMA" : "NORMAL"),
          
          imageUrl,
          pdfUrl,
          
          // Legacy fields for backward compatibility
          temperature: Number(data.tempOvoscanReal || data.tempSynchroReal) || 0,
          humidity: Number(data.humidityReal) || 0,
        }
      });

      await prisma.$disconnect();
    } catch (dbError) {
      console.error('[Report Controller] Error guardando en BD:', dbError);
      // Continuamos aunque la BD falle — ya tenemos las URLs de Drive
    }

    return res.status(201).json({
      success: true,
      message: 'Reporte procesado y almacenado exitosamente.',
      report: {
        machineId,
        isAlarm: savedReport?.isAlarm || false,
        imageUrl,
        pdfUrl,
        savedToDb: !!savedReport,
      }
    });

  } catch (error) {
    console.error('[Report Controller] Error general:', error);
    return res.status(500).json({ error: 'Error interno al procesar el reporte.' });
  }
};
