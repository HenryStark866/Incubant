import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Creates a professional PDF summary of the machine report.
 * @param machine - The machine data
 * @param operator - The operator info
 * @param extractedData - The variables from Gemini or Manual override
 * @param photoBuffer - The photo taken of the dashboard (optional)
 * @returns Buffer containing the rendered PDF
 */
export async function generateReportPDF(
  machine: any,
  operator: any,
  extractedData: any,
  photoBuffer?: Buffer
) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  
  // Header Box
  page.drawRectangle({
    x: 0,
    y: height - 80,
    width,
    height: 80,
    color: rgb(0.96, 0.65, 0.13), // Incubant primary orange
  });

  page.drawText('INCUBANT INTEGRAL - REPORTE DE ESTADO', {
    x: 40,
    y: height - 45,
    size: 20,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  // Metadata Section
  page.drawText('Detalles Operativos', { x: 40, y: height - 120, size: 14, font: boldFont });
  const metaLines = [
    `Fecha Emitida: ${new Date().toLocaleString('es-CO')}`,
    `Máquina Evaluada: ${machine?.name || machine?.id || 'Desconocida'}`,
    `Tipo/Rol: ${machine?.type?.toUpperCase() || 'INDUSTRIAL'}`,
    `Operario: ${operator?.name || 'Sistema'}`,
    `Turno Base: ${operator?.shift || 'Desconocido'}`
  ];

  metaLines.forEach((line, i) => {
    page.drawText(line, { x: 40, y: height - 145 - (i * 20), size: 10, font });
  });

  // Extracted Data Section
  page.drawText('Parámetros Analizados', { x: 40, y: height - 270, size: 14, font: boldFont });
  
  const dataLines = [
    `Temperatura (°C/°F): ${extractedData?.temperature || 'N/A'}`,
    `Humedad Relativa (%): ${extractedData?.humidity || 'N/A'}`,
    `Estado Diagnóstico: ${extractedData?.processStatus || 'N/A'}`,
  ];
  
  dataLines.forEach((line, i) => {
    page.drawText(line, { x: 40, y: height - 295 - (i * 20), size: 11, font });
  });

  // Evidence Photo
  if (photoBuffer) {
    page.drawText('Evidencia Visual: Panel / Máquina', { x: 40, y: height - 380, size: 14, font: boldFont });
    try {
      // Intentar incrustar como JPG primero (es lo más común desde móviles)
      // Si falla, se podría intentar PNG catch
      let image;
      try {
        image = await pdfDoc.embedJpg(photoBuffer);
      } catch {
        image = await pdfDoc.embedPng(photoBuffer);
      }
      
      const imgDims = image.scale(0.4);
      const imgX = (width / 2) - (imgDims.width / 2);
      
      // Rectángulo gris de fondo
      page.drawRectangle({
         x: imgX - 5, y: height - 400 - imgDims.height - 5,
         width: imgDims.width + 10, height: imgDims.height + 10,
         color: rgb(0.9, 0.9, 0.9)
      });
      
      page.drawImage(image, {
        x: imgX,
        y: height - 400 - imgDims.height,
        width: imgDims.width,
        height: imgDims.height,
      });

    } catch (e) {
      page.drawText('(La evidencia visual no pudo ser procesada en el PDF)', {
        x: 40, y: height - 400, size: 10, font, color: rgb(1, 0, 0)
      });
    }
  }

  // Footer
  page.drawText('Documento generado digitalmente. Sistema Incubant Monitor v0.1.0', {
    x: 40, y: 30, size: 8, font, color: rgb(0.5, 0.5, 0.5)
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
