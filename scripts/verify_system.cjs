/**
 * Pruebas de Estrés y Validación del Sistema Integral - Incubant
 * Valida: Gemini AI Vision, Google Drive Upload, PDF Generation, Database Persistence.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { analyzeIncubatorImage } = require('../backend/services/vision.service');
const { uploadToDrive } = require('../backend/services/drive.service');
const { generateReportPDF } = require('../backend/services/pdf.service');
const { PrismaClient } = require('@prisma/client');

// Re-map environment variables if needed
const FOLDER_PHOTOS = process.env.DRIVE_FOLDER_PHOTOS_ID;
const FOLDER_REPORTS = process.env.DRIVE_FOLDER_REPORTS_ID;

const TEST_MACHINES = [
  { id: 'inc-1', imagePath: 'test_data/inc1.png', type: 'INCUBADORA' },
  { id: 'nac-5', imagePath: 'test_data/nac5.png', type: 'NACEDORA' }
];

async function runTestFlow() {
  console.log('\r\n🚀 INICIANDO PRUEBA DE ESTRÉS / VALIDACIÓN INTEGRAL - INCUBANT\r\n');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'sslmode=require'
      }
    }
  });

  const results = [];

  for (const m of TEST_MACHINES) {
    console.log(`--- [PROCESANDO MÁQUINA: ${m.id}] ---`);
    
    try {
      // 1. Lectura de imagen local
      const imageBuffer = fs.readFileSync(path.join(__dirname, '..', m.imagePath));
      console.log('  ✅ Imagen leída: ' + m.id);

      // 2. IA Vision (Gemini)
      console.log('  ⏳ Analizando con Gemini AI Vision...');
      const base64 = imageBuffer.toString('base64');
      const aiData = await analyzeIncubatorImage(base64, 'image/png');
      console.log('  ✅ Gemini Detectó:', aiData);

      // 3. Google Drive (Foto)
      console.log('  ⏳ Subiendo foto a Google Drive...');
      const photoName = `STRESS_TEST_Photo_${m.id}_${Date.now()}.png`;
      const photoRes = await uploadToDrive(imageBuffer, photoName, 'image/png', FOLDER_PHOTOS);
      console.log('  ✅ Drive Foto URL:', photoRes.publicUrl);

      // 4. PDF Generation
      console.log('  ⏳ Generando PDF del reporte...');
      const manualData = {
        tempOvoscanReal: aiData.temperature || 99.5,
        tempOvoscanSP: 99.5,
        tempAireReal: 99.6,
        tempAireSP: 99.6,
        humidityReal: aiData.humidity || 55,
        humiditySP: 55,
        co2Real: 0.5,
        co2SP: 0.5,
        processStatus: aiData.processStatus || 'NORMAL',
        observaciones: 'REPORTE AUTOMÁTICO DE PRUEBA DE ESTRÉS'
      };
      
      const pdfBuffer = await generateReportPDF(
        { id: m.id, name: `Máquina ${m.id}` },
        { name: 'SISTEMA_AUTO_TEST', shift: 'TESTING' },
        manualData,
        imageBuffer
      );
      console.log('  ✅ PDF Generado exitosamente.');

      // 5. Google Drive (PDF)
      console.log('  ⏳ Subiendo PDF a Google Drive...');
      const pdfName = `STRESS_TEST_Report_${m.id}_${Date.now()}.pdf`;
      const pdfRes = await uploadToDrive(pdfBuffer, pdfName, 'application/pdf', FOLDER_REPORTS);
      console.log('  ✅ Drive PDF URL:', pdfRes.publicUrl);

      // 6. Prisma / DB
      console.log('  ⏳ Guardando en Supabase (Prisma)...');
      let dbMachine = await prisma.machine.findFirst({
        where: { tipo: m.type, numero_maquina: parseInt(m.id.split('-')[1]) }
      });
      if (!dbMachine) {
        dbMachine = await prisma.machine.create({
          data: { tipo: m.type, numero_maquina: parseInt(m.id.split('-')[1]) }
        });
      }

      await prisma.report.create({
        data: {
          machine_id: dbMachine.id,
          user_id: 'admin', // Asumimos que existe o fallback
          temperature: aiData.temperature || 99.5,
          humidity: aiData.humidity || 55,
          isAlarm: false,
          processStatus: 'TEST_OK',
          imageUrl: photoRes.publicUrl,
          pdfUrl: pdfRes.publicUrl,
          observaciones: ' VALIDACIÓN DE ESTRÉS COMPLETADA EXITOSAMENTE'
        }
      });
      console.log('  ✅ Persistencia en Base de Datos exitosa.');

      results.push({ machine: m.id, ok: true, photo: photoRes.publicUrl, pdf: pdfRes.publicUrl });

    } catch (err) {
      console.error(`  ❌ ERROR en máquina ${m.id}:`, err.message);
      results.push({ machine: m.id, ok: false, error: err.message });
    }
    console.log('\n');
  }

  console.log('--- [RESULTADO GLOBAL] ---');
  console.table(results);
  
  await prisma.$disconnect();
}

runTestFlow().catch(console.error);
