import { google } from 'googleapis';
import { Readable } from 'stream';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Use the same auth pattern as the backend service
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY
  ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/\r/g, '').replace(/^["']|["']$/g, '').trim()
  : undefined;

console.log('Auth config:');
console.log('  Client email:', CLIENT_EMAIL);
console.log('  Private key length:', PRIVATE_KEY?.length);
console.log('  Has BEGIN marker:', PRIVATE_KEY?.includes('BEGIN PRIVATE KEY'));

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: CLIENT_EMAIL,
    private_key: PRIVATE_KEY,
  },
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });

async function uploadToDrive(buffer: Buffer, filename: string, mimeType: string, folderId: string) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const fileMetadata = { name: filename, parents: [folderId] };
  const media = { mimeType, body: stream };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, webViewLink, webContentLink',
  });

  const fileId = response.data.id;
  if (fileId) {
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });
  }

  return { id: fileId, publicUrl: response.data.webViewLink };
}

function generateTestPhoto(): Buffer {
  // Minimal valid JPEG (1x1 orange pixel)
  return Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
    0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
    0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
    0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
    0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
    0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
    0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
    0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD5, 0xDB, 0x20, 0xA8, 0xFA, 0x28, 0x28,
    0x28, 0x3F, 0xFF, 0xD9,
  ]);
}

async function generateTestPDF(type: 'hourly' | 'closing'): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: rgb(0.97, 0.58, 0.1) });
  page.drawText('INCUBANT MONITOR', { x: 40, y: height - 40, size: 24, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText(type === 'hourly' ? 'REPORTE POR HORA - PRUEBA' : 'REPORTE CIERRE DE TURNO - PRUEBA', {
    x: 40, y: height - 65, size: 12, font, color: rgb(1, 1, 1),
  });

  let y = height - 120;
  const addLine = (text: string, bold = false) => {
    page.drawText(text, { x: 40, y, size: 12, font: bold ? boldFont : font, color: rgb(0.2, 0.2, 0.2) });
    y -= 25;
  };

  addLine('Archivo de Prueba - Verificacion de Sistema', true);
  addLine('');
  addLine(`Fecha y Hora: ${new Date().toLocaleString('es-CO')}`);
  addLine('Operario: Administrador (admin)');
  addLine('Turno: Gestion');

  if (type === 'hourly') {
    addLine('');
    addLine('Datos de Maquina INC-01:', true);
    addLine('  Temperatura Ovoscan: 99.5 F (SP: 99.5 F)');
    addLine('  Temperatura Aire: 100.2 F (SP: 100.0 F)');
    addLine('  Humedad: 60.5% (SP: 60.0%)');
    addLine('  CO2: 0.08% (SP: 0.08%)');
    addLine('  Estado: NORMAL');
    addLine('');
    addLine('Este PDF fue generado automaticamente para verificar');
    addLine('que los reportes por hora se guardan en la carpeta');
    addLine('"Reportes por Hora" de Google Drive.');
  } else {
    addLine('');
    addLine('Resumen del Turno:', true);
    addLine('  Total maquinas revisadas: 10');
    addLine('  Alarmas registradas: 0');
    addLine('  Observaciones: Sin novedades');
    addLine('');
    addLine('Este PDF fue generado automaticamente para verificar');
    addLine('que los cierres de turno se guardan en la carpeta');
    addLine('"Cierres de Turno" de Google Drive.');
  }

  page.drawRectangle({ x: 0, y: 0, width, height: 40, color: rgb(0.95, 0.95, 0.95) });
  page.drawText('Generado automaticamente por Incubant Monitor - Archivo de prueba', {
    x: 40, y: 15, size: 8, font, color: rgb(0.5, 0.5, 0.5),
  });

  return Buffer.from(await pdfDoc.save());
}

async function main() {
  try {
    const FOLDER_PHOTOS = process.env.DRIVE_FOLDER_PHOTOS_ID;
    const FOLDER_REPORTS = process.env.DRIVE_FOLDER_REPORTS_ID;
    const FOLDER_CLOSING = process.env.DRIVE_FOLDER_CLOSING_REPORTS_ID;

    console.log('Verificando carpetas de Drive...');
    console.log(`  Fotos: ${FOLDER_PHOTOS}`);
    console.log(`  Reportes por Hora: ${FOLDER_REPORTS}`);
    console.log(`  Cierres de Turno: ${FOLDER_CLOSING}`);

    if (!FOLDER_PHOTOS || !FOLDER_REPORTS || !FOLDER_CLOSING) {
      console.error('Faltan IDs de carpetas de Drive');
      process.exit(1);
    }

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    console.log('\n1. Subiendo foto de prueba a carpeta Fotos...');
    const photoBuffer = generateTestPhoto();
    const photoName = `${ts}_PRUEBA_Foto_Admin.jpg`;
    const photoResult = await uploadToDrive(photoBuffer, photoName, 'image/jpeg', FOLDER_PHOTOS);
    console.log(`   OK Foto subida: ${photoResult.publicUrl}`);

    console.log('\n2. Subiendo PDF reporte por hora a carpeta Reportes...');
    const hourlyPdfBuffer = await generateTestPDF('hourly');
    const hourlyPdfName = `${ts}_PRUEBA_ReporteHora_Admin.pdf`;
    const hourlyResult = await uploadToDrive(hourlyPdfBuffer, hourlyPdfName, 'application/pdf', FOLDER_REPORTS);
    console.log(`   OK PDF subido: ${hourlyResult.publicUrl}`);

    console.log('\n3. Subiendo PDF cierre de turno a carpeta Cierres...');
    const closingPdfBuffer = await generateTestPDF('closing');
    const closingPdfName = `${ts}_PRUEBA_CierreTurno_Admin.pdf`;
    const closingResult = await uploadToDrive(closingPdfBuffer, closingPdfName, 'application/pdf', FOLDER_CLOSING);
    console.log(`   OK PDF subido: ${closingResult.publicUrl}`);

    console.log('\nTODOS LOS ARCHIVOS DE PRUEBA SUBIDOS EXITOSAMENTE');
    console.log('\nVerifica las carpetas de Google Drive:');
    console.log(`  Fotos: https://drive.google.com/drive/folders/${FOLDER_PHOTOS}`);
    console.log(`  Reportes por Hora: https://drive.google.com/drive/folders/${FOLDER_REPORTS}`);
    console.log(`  Cierres de Turno: https://drive.google.com/drive/folders/${FOLDER_CLOSING}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
