import { Request, Response } from 'express';
import { analyzeIncubatorImage } from '../services/vision.service';
import { uploadToDrive } from '../services/drive.service';
import { generateReportPDF } from '../services/pdf.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Carpetas destino preconfiguradas en Drive (se sacarían de ENV en un caso real)
const PHOTOS_FOLDER_ID = process.env.DRIVE_PHOTOS_FOLDER || '1LSI9hpfQiYD0w0U79Noh6tI1BDgnHwqn';
const REPORTS_FOLDER_ID = process.env.DRIVE_REPORTS_FOLDER || '15NhdznwFJycDOFsQs9dZwTS6vR_srfXi';

export const processMachineReport = async (req: Request, res: Response) => {
  try {
    const { machineId, reportData } = req.body;
    const file = req.file; // From multer
    
    // Asumimos que el usuario viene serializado en un token real de auth middleware.
    // getSession() o algo similar lo inyectaría en req.user
    const userId = (req as any).user?.id;

    if (!machineId || !userId) {
      return res.status(400).json({ error: 'Faltan parámetros críticos (machineId, userId)' });
    }

    if (!file) {
      return res.status(400).json({ error: 'No se recibió ninguna imagen de evidencia' });
    }

    // 1. Convertir archivo a Base64 para Gemini
    const base64Image = file.buffer.toString('base64');
    const mimeType = file.mimetype;

    // 2. Extraer datos con IA
    let extractedData;
    try {
      extractedData = await analyzeIncubatorImage(base64Image, mimeType);
    } catch (visionError) {
      console.warn('Fallo visión artificial, usando defaults o fallback manual', visionError);
      extractedData = { temperature: 0, humidity: 0, processStatus: 'DESCONOCIDO' };
    }

    // Si había datos manuales en "reportData" (JSON stringificado desde el cliente), priman
    let finalData = extractedData;
    if (reportData) {
      const parsedManual = JSON.parse(reportData);
      finalData = { ...finalData, ...parsedManual };
    }

    // 3. Subir Evidencia Fotográfica a Drive
    const photoDriveRes = await uploadToDrive(
       file.buffer, 
       `Foto_${machineId}_${Date.now()}.jpg`, 
       mimeType, 
       PHOTOS_FOLDER_ID
    );

    // 4. Generar y Subir PDF de Respaldo
    const pdfBuffer = await generateReportPDF(
      { id: machineId }, 
      { name: (req as any).user?.name, shift: (req as any).user?.shift }, 
      finalData, 
      file.buffer
    );

    const pdfDriveRes = await uploadToDrive(
       pdfBuffer, 
       `Reporte_${machineId}_${Date.now()}.pdf`, 
       'application/pdf', 
       REPORTS_FOLDER_ID
    );

    // 5. Consolidar en Prisma (PostgreSQL / Supabase)
    const newReport = await prisma.report.create({
      data: {
        machine_id: machineId,
        user_id: userId,
        temperature: Number(finalData.temperature) || 0,
        humidity: Number(finalData.humidity) || 0,
        processStatus: String(finalData.processStatus),
        imageUrl: photoDriveRes.publicUrl,
        pdfUrl: pdfDriveRes.publicUrl,
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Reporte procesado exitosamente',
      report: newReport,
      cloudLinks: {
        evidence: photoDriveRes.publicUrl,
        pdf: pdfDriveRes.publicUrl
      }
    });

  } catch (error) {
    console.error('[Report Controller] Error general procesando reporte:', error);
    return res.status(500).json({ error: 'Fallo interno al procesar el reporte de incubadora' });
  }
};
