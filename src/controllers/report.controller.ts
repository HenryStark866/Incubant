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

    // 2. Subir foto de evidencia a Google Drive
    let imageUrl = '';
    try {
      const photoName = `Foto_${machineId}_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
      const driveResult = await uploadToDrive(file.buffer, photoName, file.mimetype, 'photos');
      imageUrl = driveResult.publicUrl;
    } catch (driveError) {
      console.warn('[Report Controller] Drive upload falló para foto:', driveError);
    }

    // 3. Generar PDF y subirlo a Drive
    let pdfUrl = '';
    try {
      const pdfBuffer = await generateReportPDF(
        { id: machineId, name: `Máquina ${machineId}` },
        { name: req.user?.name || 'Operario', shift: req.user?.shift },
        finalData,
        file.buffer
      );
      const pdfName = `Reporte_${machineId}_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
      const pdfResult = await uploadToDrive(pdfBuffer, pdfName, 'application/pdf', 'reports');
      pdfUrl = pdfResult.publicUrl;
    } catch (pdfError) {
      console.warn('[Report Controller] PDF generation/upload falló:', pdfError);
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

      // Crear el reporte
      savedReport = await prisma.report.create({
        data: {
          machine_id: machine.id,
          user_id: userId,
          temperature: Number(finalData.temperature) || 0,
          humidity: Number(finalData.humidity) || 0,
          processStatus: String(finalData.processStatus),
          imageUrl,
          pdfUrl,
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
        temperature: `${finalData.temperature} °F`,
        humidity: `${finalData.humidity} %`,
        processStatus: finalData.processStatus,
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
