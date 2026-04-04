import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Creates a professional PDF summary of the machine report.
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
  
  // Header
  page.drawRectangle({
    x: 0,
    y: height - 80,
    width,
    height: 80,
    color: rgb(0.96, 0.58, 0.1), // Incubant primary orange
  });

  page.drawText('INCUBANT MONITOR - REPORTE DE MÁQUINA', {
    x: 30,
    y: height - 45,
    size: 20,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  // Info Section
  const yStart = height - 120;
  page.drawText(`Operario: ${operator.nombre || 'Desconocido'}`, { x: 30, y: yStart, size: 12, font });
  page.drawText(`Máquina: ${machine.tipo || 'INC'} #${machine.numero_maquina}`, { x: 30, y: yStart - 20, size: 12, font });
  page.drawText(`Fecha: ${new Date().toLocaleString()}`, { x: 30, y: yStart - 40, size: 12, font });

  // Data Section
  page.drawText('DATOS REGISTRADOS:', { x: 30, y: yStart - 80, size: 14, font: boldFont });
  page.drawText(`Temperatura Principal: ${extractedData.temperature}°C`, { x: 50, y: yStart - 105, size: 12, font });
  page.drawText(`Humedad/CO2: ${extractedData.humidity}%`, { x: 50, y: yStart - 125, size: 12, font });
  page.drawText(`Estado: ${extractedData.processStatus || 'NORMAL'}`, { x: 50, y: yStart - 145, size: 12, font });

  // Evidence Image (support both JPG and PNG)
  if (photoBuffer) {
    try {
      let image;
      const isPng = photoBuffer[0] === 0x89 && photoBuffer[1] === 0x50 && photoBuffer[2] === 0x4E && photoBuffer[3] === 0x47;
      if (isPng) {
        image = await pdfDoc.embedPng(photoBuffer);
      } else {
        image = await pdfDoc.embedJpg(photoBuffer);
      }
      const dims = image.scale(0.5);
      page.drawImage(image, {
        x: (width - dims.width) / 2,
        y: 100,
        width: dims.width,
        height: dims.height,
      });
      page.drawText('EVIDENCIA FOTOGRÁFICA:', { x: 30, y: dims.height + 120, size: 12, font: boldFont });
    } catch (e) {
      console.warn('[PDF Service] Error injecting photo:', e);
    }
  }

  page.drawText('Generado por Incubant Zero-Touch AI Analysis', {
    x: 30,
    y: 30,
    size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  return Buffer.from(await pdfDoc.save());
}

/**
 * Generates a summary PDF (Shift Closing Report) with a table of logs.
 */
export async function generateSummaryPDF(
  operatorName: string,
  shiftLabel: string,
  logs: any[]
) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([841.89, 595.28]); // A4 Landscape
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  // Color theme
  const orange = rgb(0.96, 0.58, 0.1);

  // Header Title
  page.drawText('REPORTE DE CIERRE DE TURNO - INCUBANT', {
    x: 40,
    y: height - 60,
    size: 18,
    font: boldFont,
    color: orange,
  });

  // Footer & Metadata
  page.drawText(`Operario: ${operatorName} | Turno: ${shiftLabel}`, { x: 40, y: height - 90, size: 11, font });
  page.drawText(`Fecha: ${new Date().toLocaleString()}`, { x: 40, y: height - 105, size: 11, font });
  page.drawText(`Total Registros: ${logs.length}`, { x: 40, y: height - 120, size: 11, font });

  // Table Headers
  const tableTop = height - 160;
  const colX = [40, 110, 200, 300, 400, 500, 600];
  const headers = ['HORA', 'MÁQUINA', 'T. OVO (F)', 'T. AIRE (F)', 'HUM/CO2', 'ESTADO', 'OBS'];

  page.drawRectangle({
    x: 35,
    y: tableTop - 5,
    width: width - 70,
    height: 25,
    color: orange,
  });

  headers.forEach((h, i) => {
    page.drawText(h, {
      x: colX[i],
      y: tableTop,
      size: 10,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
  });

  // Table Data Rows
  let curY = tableTop - 30;
  logs.forEach((log, idx) => {
    if (idx < 15) { // Para evitar desborde en una sola página (MVP)
      const rowColor = idx % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.98, 0.98);
      page.drawRectangle({
        x: 35,
        y: curY - 5,
        width: width - 70,
        height: 20,
        color: rowColor,
      });

      const time = new Date(log.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const machineName = `${log.machine.tipo === 'INCUBADORA' ? 'INC' : 'NAC'}-${log.machine.numero_maquina.toString().padStart(2, '0')}`;
      
      const rowData = [
        time,
        machineName,
        log.temp_principal_actual.toFixed(1),
        log.temp_secundaria_actual.toFixed(1),
        log.co2_actual.toFixed(1),
        log.is_na ? 'APAGADA' : 'OK',
        (log.observaciones || 'Sin novedad').substring(0, 30)
      ];

      rowData.forEach((val, i) => {
        page.drawText(String(val), {
          x: colX[i],
          y: curY,
          size: 9,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
      });

      curY -= 20;
    }
  });

  // Footer branding
  page.drawText('Incubant Zero-Touch Reporting Platform - Antioqueña de Incubación S.A.S.', {
    x: width / 2 - 150,
    y: 30,
    size: 8,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });

  return Buffer.from(await pdfDoc.save());
}
