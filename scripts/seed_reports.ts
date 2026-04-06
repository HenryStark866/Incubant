import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Helper to simulate the exact uploads and inserts.
async function seedReports() {
  const { uploadToSupabase } = await import('../backend/services/supabase_storage.service');
  const { generateReportPDF, generateSummaryPDF } = await import('../backend/services/pdf.service');
  
  const prisma = new PrismaClient();
  const userName = 'Admin Seed';
  const userId = 'admin'; // Valid user ID from predefinedUsers
  
  // 1. Ensure machine
  let machine = await prisma.machine.findFirst({ where: { id: 'B01' } });
  if (!machine) {
    machine = await prisma.machine.create({ data: { id: 'B01', tipo: 'INCUBADORA', numero_maquina: 1 } });
  }

  // 1. Upload photo 
  console.log('Subiendo foto...');
  const imgPath = path.join(process.cwd(), '..', '.gemini', 'antigravity', 'brain', 'c763c87f-2440-4d54-84ca-3fce452a0b4a', 'incubator_example_1775431302827.png');
  let photoBuf: Buffer;
  try {
    photoBuf = fs.readFileSync(imgPath);
  } catch (e) {
    console.log('Photo not found, using empty logic.');
    return;
  }
  
  const photoResult = await uploadToSupabase(photoBuf, userName, 'photos', 'image/png', `inc-1`);
  
  // 2. Generate and upload individual PDF
  console.log('Generando PDF Individual...');
  const indivPdf = await generateReportPDF(
    machine,
    { nombre: userName },
    { temperature: '99.5', humidity: '53.0', processStatus: 'NORMAL' },
    photoBuf
  );
  const pdfIndivResult = await uploadToSupabase(indivPdf, userName, 'reports', 'application/pdf');

  // Insert to DB
  const dateIndiv = new Date();
  
  const report = await prisma.report.create({
    data: {
      machine_id: machine.id,
      user_id: userId,
      fecha_hora: dateIndiv,
      tempPrincipalReal: 99.5,
      tempPrincipalSP: 99.5,
      tempAireReal: 99.8,
      tempAireSP: 100.0,
      humidityReal: 53.0,
      humiditySP: 53.0,
      co2Real: 300,
      co2SP: 300,
      isAlarm: false,
      isClosingReport: false,
      observaciones: 'Reporte Base (Semilla)',
      processStatus: 'NORMAL',
      imageUrl: photoResult.publicUrl,
      pdfUrl: pdfIndivResult.publicUrl,
      temperature: 99.5,
      humidity: 53.0
    }
  });

  const hourly = await prisma.hourlyLog.create({
    data: {
      user_id: userId,
      machine_id: machine.id,
      fecha_hora: dateIndiv,
      photo_url: photoResult.publicUrl,
      temp_principal_actual: 99.5,
      temp_principal_consigna: 99.5,
      temp_secundaria_actual: 99.8,
      temp_secundaria_consigna: 100.0,
      humedad_actual: 53.0,
      humedad_consigna: 53.0,
      co2_actual: 300,
      co2_consigna: 300,
      is_na: false,
      observaciones: 'Reporte Base (Semilla)',
    }
  });

  console.log('Reporte individual guardado.');

  // 3. Generate and upload closing PDF
  console.log('Generando PDF de Cierre...');
  const closingPdf = await generateSummaryPDF(userName, 'Turno Demostracion', [
    { ...hourly, machine }
  ]);
  const pdfClosingResult = await uploadToSupabase(closingPdf, userName, 'reports', 'application/pdf');

  await prisma.report.create({
    data: {
      machine_id: machine.id,
      user_id: userId,
      fecha_hora: new Date(dateIndiv.getTime() + 1000), // 1 segundo despues
      pdfUrl: pdfClosingResult.publicUrl,
      isClosingReport: true,
      observaciones: 'Cierre de Turno Base (Semilla)',
    }
  });

  console.log('Reporte de cierre guardado.');
}

seedReports().catch(console.error);
