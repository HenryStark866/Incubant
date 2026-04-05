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
  const orange = rgb(0.96, 0.58, 0.1);
  const darkGray = rgb(0.2, 0.2, 0.2);
  const lightGray = rgb(0.95, 0.95, 0.95);

  // Top Banner
  page.drawRectangle({
    x: 0, y: height - 90, width, height: 90, color: orange,
  });

  page.drawText('INCUBANT MONITOR', { x: 40, y: height - 40, size: 24, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('REPORTE PROFESIONAL DE INSPECCIÓN', { x: 40, y: height - 60, size: 12, font, color: rgb(1, 1, 1) });

  // Metadata Box
  const yStart = height - 120;
  
  page.drawText('INFORMACIÓN METADATA', { x: 40, y: yStart - 20, size: 12, font: boldFont, color: orange });
  page.drawLine({ start: { x: 40, y: yStart - 25 }, end: { x: width - 40, y: yStart - 25 }, thickness: 1, color: orange });

  const labelX = 40;
  const valX = 140;

  page.drawText('Operario:', { x: labelX, y: yStart - 50, size: 11, font: boldFont, color: darkGray });
  page.drawText(operator.nombre || 'Desconocido', { x: valX, y: yStart - 50, size: 11, font, color: darkGray });

  page.drawText('Máquina:', { x: labelX, y: yStart - 70, size: 11, font: boldFont, color: darkGray });
  page.drawText(`${machine.tipo || 'INC'} #${machine.numero_maquina}`, { x: valX, y: yStart - 70, size: 11, font, color: darkGray });

  page.drawText('Fecha/Hora:', { x: labelX, y: yStart - 90, size: 11, font: boldFont, color: darkGray });
  page.drawText(new Date().toLocaleString('es-CO'), { x: valX, y: yStart - 90, size: 11, font, color: darkGray });

  // Data Section
  const dataY = yStart - 140;
  page.drawText('LECTURAS DEL SISTEMA', { x: 40, y: dataY, size: 12, font: boldFont, color: orange });
  page.drawLine({ start: { x: 40, y: dataY - 5 }, end: { x: width - 40, y: dataY - 5 }, thickness: 1, color: orange });

  // Render a nice table/box for data
  page.drawRectangle({ x: 40, y: dataY - 80, width: width - 80, height: 60, color: lightGray, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
  
  page.drawText('TEMPERATURA', { x: 60, y: dataY - 40, size: 10, font: boldFont, color: darkGray });
  page.drawText(`${extractedData.temperature}°F`, { x: 60, y: dataY - 60, size: 16, font: boldFont, color: darkGray });

  page.drawText('HUM / CO2', { x: 220, y: dataY - 40, size: 10, font: boldFont, color: darkGray });
  page.drawText(`${extractedData.humidity}% / ppm`, { x: 220, y: dataY - 60, size: 16, font: boldFont, color: darkGray });

  const statusColor = extractedData.processStatus === 'ALARMA' ? rgb(0.9, 0.2, 0.2) : rgb(0.1, 0.7, 0.3);
  page.drawText('ESTADO FÍSICO', { x: 380, y: dataY - 40, size: 10, font: boldFont, color: darkGray });
  page.drawText(extractedData.processStatus || 'NORMAL', { x: 380, y: dataY - 60, size: 14, font: boldFont, color: statusColor });

  // Evidence Image (support both JPG and PNG)
  let photoBottom = dataY - 120;
  if (photoBuffer) {
    page.drawText('EVIDENCIA FOTOGRÁFICA', { x: 40, y: photoBottom, size: 12, font: boldFont, color: orange });
    page.drawLine({ start: { x: 40, y: photoBottom - 5 }, end: { x: width - 40, y: photoBottom - 5 }, thickness: 1, color: orange });

    try {
      let image;
      const isPng = photoBuffer[0] === 0x89 && photoBuffer[1] === 0x50 && photoBuffer[2] === 0x4E && photoBuffer[3] === 0x47;
      if (isPng) {
        image = await pdfDoc.embedPng(photoBuffer);
      } else {
        image = await pdfDoc.embedJpg(photoBuffer);
      }
      
      const maxW = width - 80;
      const maxH = 400;
      let imgWidth = image.width;
      let imgHeight = image.height;

      if (imgWidth > maxW) {
        imgHeight = (maxW / imgWidth) * imgHeight;
        imgWidth = maxW;
      }
      if (imgHeight > maxH) {
        imgWidth = (maxH / imgHeight) * imgWidth;
        imgHeight = maxH;
      }

      page.drawImage(image, {
        x: (width - imgWidth) / 2,
        y: photoBottom - imgHeight - 20,
        width: imgWidth,
        height: imgHeight,
      });

      // Frame around image
      page.drawRectangle({
        x: ((width - imgWidth) / 2) - 1,
        y: (photoBottom - imgHeight - 20) - 1,
        width: imgWidth + 2,
        height: imgHeight + 2,
        borderColor: rgb(0.8,0.8,0.8),
        borderWidth: 1,
        color: undefined,
      });

    } catch (e) {
      console.warn('[PDF Service] Error injecting photo:', e);
      page.drawText('Error al cargar la imagen adjunta.', { x: 40, y: photoBottom - 30, size: 10, font, color: rgb(0.8,0,0) });
    }
  }

  // Footer
  page.drawText('Reporte Oficial Generado por Incubant Zero-Touch AI Platform', {
    x: 40, y: 30, size: 9, font, color: rgb(0.5, 0.5, 0.5),
  });
  page.drawText('Documento verificado y almacenado', {
    x: width - 180, y: 30, size: 9, font: boldFont, color: rgb(0.5, 0.5, 0.5),
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
  const darkGray = rgb(0.2, 0.2, 0.2);
  const lightGray = rgb(0.97, 0.97, 0.97);

  // Top header banner
  page.drawRectangle({ x: 0, y: height - 70, width, height: 70, color: orange });
  
  page.drawText('REPORTE INTEGRAL DE CIERRE DE TURNO', { x: 40, y: height - 35, size: 18, font: boldFont, color: rgb(1,1,1) });
  page.drawText('INCUBANT ZERO-TOUCH SYSTEM', { x: 40, y: height - 50, size: 10, font: boldFont, color: rgb(1,1,1) });

  // Metadata block
  page.drawRectangle({ x: 40, y: height - 120, width: width - 80, height: 35, color: lightGray, borderColor: rgb(0.9,0.9,0.9), borderWidth: 1 });
  page.drawText(`OPERARIO RESPONSABLE: `, { x: 50, y: height - 105, size: 9, font: boldFont, color: orange });
  page.drawText(`${operatorName.toUpperCase()}`, { x: 175, y: height - 105, size: 9, font: boldFont, color: darkGray });

  page.drawText(`TURNO EJECUTADO: `, { x: 350, y: height - 105, size: 9, font: boldFont, color: orange });
  page.drawText(`${shiftLabel.toUpperCase()}`, { x: 450, y: height - 105, size: 9, font: boldFont, color: darkGray });

  page.drawText(`FECHA DE EMISIÓN: `, { x: 600, y: height - 105, size: 9, font: boldFont, color: orange });
  page.drawText(`${new Date().toLocaleString('es-CO')}`, { x: 695, y: height - 105, size: 9, font: boldFont, color: darkGray });

  // Table Setup
  const tableTop = height - 160;
  const colX = [45, 100, 160, 230, 310, 390, 480, 560];
  const headers = ['HORA', 'MÁQ.', 'ESTADO', 'T. OVO(°F)', 'T. AIR(°F)', 'HUM(%) / CO2', 'ALARMAS', 'OBSERVACIONES'];

  // Table Headers
  page.drawRectangle({ x: 40, y: tableTop - 5, width: width - 80, height: 25, color: orange });

  headers.forEach((h, i) => {
    page.drawText(h, { x: colX[i], y: tableTop, size: 9, font: boldFont, color: rgb(1, 1, 1) });
  });

  let curY = tableTop - 30;
  // Maximum 20 rows per page to prevent overflow
  logs.slice(0, 20).forEach((log, idx) => {
    const rowColor = idx % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.98, 0.98);
    page.drawRectangle({ x: 40, y: curY - 6, width: width - 80, height: 22, color: rowColor });

    // Formatting fields
    const time = new Date(log.fecha_hora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const machineName = `${log.machine.tipo === 'INCUBADORA' ? 'INC' : 'NAC'}-${log.machine.numero_maquina.toString().padStart(2, '0')}`;
    const statusText = log.is_na ? 'APAGADA' : 'OPERATIVA';
    
    // Check alarm status by computing simple diff (sp vs real)
    const isAlarm = Math.abs(log.temp_principal_actual - log.temp_principal_consigna) > 0.5 || 
                    Math.abs(log.temp_secundaria_actual - log.temp_secundaria_consigna) > 0.5;

    const rowData = [
      time,
      machineName,
      statusText,
      log.temp_principal_actual.toFixed(1),
      log.temp_secundaria_actual.toFixed(1),
      `${(log.humedad_actual || 0).toFixed(1)} / ${log.co2_actual.toFixed(1)}`,
      isAlarm ? 'ALERTA' : 'NINGUNA',
      (log.observaciones || 'Sin novedad').replace(/\n/g, ' ').substring(0, 40)
    ];

    rowData.forEach((val, i) => {
      // Highlight alarms
      const isRed = (i === 6 && isAlarm) || (i === 2 && log.is_na);
      const isGreen = (i === 6 && !isAlarm);
      const cellColor = isRed ? rgb(0.8, 0, 0) : (isGreen ? rgb(0, 0.6, 0) : darkGray);
      
      page.drawText(String(val), {
        x: colX[i],
        y: curY,
        size: 8,
        font: i < 3 ? boldFont : font,
        color: cellColor,
      });
    });

    curY -= 22;
  });

  if (logs.length > 20) {
    page.drawText(`Y ${logs.length - 20} registros más... (Mostrando en formato resumido)`, {
      x: 45, y: curY - 5, size: 8, font: boldFont, color: orange
    });
  }

  // Footer branding
  page.drawLine({ start: { x: 40, y: 40 }, end: { x: width - 40, y: 40 }, thickness: 1, color: rgb(0.9,0.9,0.9) });
  page.drawText('Incubant Zero-Touch Reporting Platform - Antioqueta de Incubación S.A.S.', {
    x: 40, y: 25, size: 8, font: boldFont, color: rgb(0.5, 0.5, 0.5),
  });
  page.drawText('Documento Certificado Automáticamente', {
    x: width - 210, y: 25, size: 8, font, color: rgb(0.5, 0.5, 0.5),
  });

  return Buffer.from(await pdfDoc.save());
}
