/**
 * Pruebas de Estrés y Validación del Sistema Integral - Incubant (TypeScript Version)
 * Valida: Gemini AI Vision, Google Drive Upload, PDF Generation, Database Persistence.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeIncubatorImage } from '../backend/services/vision.service.ts';
import { uploadToDrive } from '../backend/services/drive.service.ts';
import { generateReportPDF } from '../backend/services/pdf.service.ts';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Re-map environment variables if needed
const FOLDER_PHOTOS = process.env.DRIVE_FOLDER_PHOTOS_ID || '';
const FOLDER_REPORTS = process.env.DRIVE_FOLDER_REPORTS_ID || '';

const TEST_MACHINES = [
  { id: 'inc-1', imagePath: 'test_data/inc1.png', type: 'INCUBADORA' as const },
  { id: 'nac-5', imagePath: 'test_data/nac5.png', type: 'NACEDORA' as const }
];

async function runTestFlow() {
  console.log('\r\n🚀 INICIANDO PRUEBA DE ESTRÉS / VALIDACIÓN INTEGRAL - INCUBANT\r\n');
  
  // Use current DB URL but ensure SSL mode for local execution consistency with Supabase
  const baseUrl = process.env.DATABASE_URL || '';
  const finalDbUrl = baseUrl.includes('?') ? `${baseUrl}&sslmode=require` : `${baseUrl}?sslmode=require`;

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: finalDbUrl
      }
    }
  });

  const results: any[] = [];

  for (const m of TEST_MACHINES) {
    console.log(`--- [PROCESANDO MÁQUINA: ${m.id}] ---`);
    
    try {
      // 1. Lectura de imagen local
      const fullPath = path.join(__dirname, '..', m.imagePath);
      if (!fs.existsSync(fullPath)) throw new Error(`Imagen no encontrada: ${fullPath}`);
      
      const imageBuffer = fs.readFileSync(fullPath);
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
        observaciones: 'REPORTE AUTOMÁTICO DE PRUEBA DE ESTRÉS - VALIDACIÓN INTEGRAL'
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
          user_id: 'admin',
          temperature: aiData.temperature || 99.5,
          humidity: aiData.humidity || 55,
          isAlarm: false,
          processStatus: 'TEST_OK',
          imageUrl: photoRes.publicUrl || '',
          pdfUrl: pdfRes.publicUrl || '',
          observaciones: 'VALIDACIÓN INTEGRAL COMPLETADA'
        }
      });
      console.log('  ✅ Persistencia en Base de Datos exitosa.');

      results.push({ 
        machine: m.id, 
        status: 'OK', 
        vision: `${aiData.temperature}°F / ${aiData.humidity}%`,
        photo: photoRes.publicUrl ? 'UPLOADED' : 'FAILED', 
        pdf: pdfRes.publicUrl ? 'UPLOADED' : 'FAILED' 
      });

    } catch (err: any) {
      console.error(`  ❌ ERROR en máquina ${m.id}:`, err.message);
      results.push({ machine: m.id, status: 'ERROR', error: err.message });
    }
    console.log('\n');
  }

  console.log('--- [RESULTADO GLOBAL] ---');
  console.table(results);
  
  await prisma.$disconnect();
}

runTestFlow().catch(console.error);
