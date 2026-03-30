import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface ReportData {
  temperature: number | null;
  humidity: number | null;
  processStatus: string;
}

interface MachineInfo {
  id: string;
  name?: string;
  type?: string;
}

interface OperatorInfo {
  name: string;
  shift?: string;
}

/**
 * Genera un PDF profesional de reporte de incubadora en formato A4.
 * REGLA DE ORO: La temperatura se muestra siempre en °F.
 */
export async function generateReportPDF(
  machine: MachineInfo,
  operator: OperatorInfo,
  reportData: ReportData,
  photoBuffer?: Buffer
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const orange = rgb(0.961, 0.647, 0.137); // #F5A623 - Incubant primary
  const dark = rgb(0.078, 0.102, 0.153);   // Brand dark
  const gray = rgb(0.45, 0.5, 0.55);
  const white = rgb(1, 1, 1);
  const red = rgb(0.87, 0.23, 0.23);
  const green = rgb(0.18, 0.71, 0.45);

  // ── HEADER ────────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 85, width, height: 85, color: dark });
  
  page.drawText('INCUBANT INTEGRAL', {
    x: 30, y: height - 38, size: 22, font: boldFont, color: orange,
  });
  page.drawText('Sistema de Monitoreo Avícola | v0.1.1-PROD', {
    x: 30, y: height - 57, size: 9, font, color: rgb(0.7, 0.75, 0.8),
  });
  page.drawText(`Desde: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`, {
    x: 30, y: height - 75, size: 8, font, color: rgb(0.5, 0.55, 0.6),
  });

  // VERSION badge
  page.drawRectangle({ x: width - 110, y: height - 55, width: 80, height: 22, color: orange });
  page.drawText('REPORTE HORARIO', {
    x: width - 107, y: height - 47, size: 7, font: boldFont, color: dark,
  });

  // ── SECTION: MACHINE INFO ─────────────────────────────────────────────────
  let y = height - 120;
  page.drawText('DATOS DE LA MÁQUINA', {
    x: 30, y, size: 12, font: boldFont, color: dark,
  });
  page.drawLine({ start: { x: 30, y: y - 5 }, end: { x: width - 30, y: y - 5 }, thickness: 1, color: orange });

  y -= 25;
  const machineLabel = machine.name || machine.id.toUpperCase();
  const machineType = machine.type ? machine.type.charAt(0).toUpperCase() + machine.type.slice(1) : 'Incubadora';
  
  const metaData = [
    ['Máquina:', machineLabel],
    ['Tipo:', machineType],
    ['Operario:', operator.name],
    ['Turno:', operator.shift || 'N/A'],
  ];

  metaData.forEach(([label, value]) => {
    page.drawText(label, { x: 30, y, size: 10, font: boldFont, color: gray });
    page.drawText(value, { x: 130, y, size: 10, font, color: dark });
    y -= 18;
  });

  // ── SECTION: MEASURED VALUES ──────────────────────────────────────────────
  y -= 15;
  page.drawText('PARÁMETROS MEDIDOS', {
    x: 30, y, size: 12, font: boldFont, color: dark,
  });
  page.drawLine({ start: { x: 30, y: y - 5 }, end: { x: width - 30, y: y - 5 }, thickness: 1, color: orange });

  y -= 30;

  // Temperatura card
  const isAlarm = reportData.processStatus === 'ALARMA';
  const statusColor = isAlarm ? red : (reportData.processStatus === 'OK' ? green : gray);

  // Fondo de tarjeta temperatura
  page.drawRectangle({ x: 30, y: y - 50, width: 155, height: 70, color: rgb(0.97, 0.97, 0.97) });
  page.drawText('Temperatura', { x: 38, y: y - 10, size: 9, font: boldFont, color: gray });
  page.drawText(
    reportData.temperature !== null ? `${reportData.temperature.toFixed(1)} °F` : 'N/A',
    { x: 38, y: y - 38, size: 22, font: boldFont, color: dark }
  );
  page.drawText('Grados Fahrenheit', { x: 38, y: y - 55, size: 7, font, color: gray });

  // Fondo de tarjeta humedad
  page.drawRectangle({ x: 200, y: y - 50, width: 155, height: 70, color: rgb(0.97, 0.97, 0.97) });
  page.drawText('Humedad Relativa', { x: 208, y: y - 10, size: 9, font: boldFont, color: gray });
  page.drawText(
    reportData.humidity !== null ? `${reportData.humidity.toFixed(1)} %` : 'N/A',
    { x: 208, y: y - 38, size: 22, font: boldFont, color: dark }
  );
  page.drawText('Porcentaje (%)', { x: 208, y: y - 55, size: 7, font, color: gray });

  // Estado
  page.drawRectangle({ x: 370, y: y - 50, width: 195, height: 70, color: isAlarm ? rgb(1, 0.95, 0.95) : rgb(0.93, 1, 0.96) });
  page.drawText('Estado del Proceso', { x: 378, y: y - 10, size: 9, font: boldFont, color: gray });
  page.drawText(reportData.processStatus, { x: 378, y: y - 38, size: 18, font: boldFont, color: statusColor });
  if (isAlarm) {
    page.drawText('⚠ REQUIERE ATENCIÓN', { x: 378, y: y - 55, size: 7, font: boldFont, color: red });
  } else {
    page.drawText('Funcionamiento normal', { x: 378, y: y - 55, size: 7, font, color: green });
  }

  y -= 75;

  // ── SECTION: EVIDENCE PHOTO ───────────────────────────────────────────────
  if (photoBuffer) {
    y -= 20;
    page.drawText('EVIDENCIA FOTOGRÁFICA', {
      x: 30, y, size: 12, font: boldFont, color: dark,
    });
    page.drawLine({ start: { x: 30, y: y - 5 }, end: { x: width - 30, y: y - 5 }, thickness: 1, color: orange });

    y -= 15;

    try {
      let image;
      try {
        image = await pdfDoc.embedJpg(photoBuffer);
      } catch {
        image = await pdfDoc.embedPng(photoBuffer);
      }
      const maxW = width - 60;
      const maxH = 260;
      const aspectRatio = image.width / image.height;
      let imgW = maxW;
      let imgH = imgW / aspectRatio;
      if (imgH > maxH) { imgH = maxH; imgW = imgH * aspectRatio; }

      const imgX = 30 + (maxW - imgW) / 2;
      y -= imgH;

      page.drawRectangle({ x: imgX - 4, y: y - 4, width: imgW + 8, height: imgH + 8, color: rgb(0.88, 0.88, 0.88) });
      page.drawImage(image, { x: imgX, y, width: imgW, height: imgH });

      y -= 14;
      page.drawText('Foto tomada por el operario en el momento del reporte', {
        x: 30, y, size: 7, font, color: gray,
      });
    } catch {
      page.drawText('(La evidencia visual no pudo ser incrustada en este documento)', {
        x: 30, y: y - 20, size: 9, font, color: red,
      });
    }
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width, height: 35, color: dark });
  page.drawText('Documento generado automáticamente • Incubant Monitor v0.1.1-PROD • Sistema de Gestión Avícola', {
    x: 30, y: 12, size: 7, font, color: rgb(0.5, 0.55, 0.6),
  });
  page.drawText('CONFIDENCIAL', {
    x: width - 90, y: 12, size: 7, font: boldFont, color: orange,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
