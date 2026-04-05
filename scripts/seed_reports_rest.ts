import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

async function seedViaRest() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Default User UUID (can be randomly chosen or one of existing ones)
  // Let's get the first user
  const { data: users, error: errUser } = await supabase.from('User').select('id, nombre').limit(1);
  if (errUser || !users || users.length === 0) {
    console.warn('No user found to assign. Seeding aborted.');
    return;
  }
  const userId = users[0].id;
  const userName = users[0].nombre;

  // Ensure machine 1 Incubadora exists
  let machineId = '';
  const { data: machines } = await supabase.from('Machine').select('id').eq('tipo', 'INCUBADORA').eq('numero_maquina', 1);
  if (machines && machines.length > 0) {
    machineId = machines[0].id;
  } else {
    // Cannot create directly with JS if RLS blocked, but if the table gives us access:
    const { data: newM, error: errM } = await supabase.from('Machine').insert({ tipo: 'INCUBADORA', numero_maquina: 1 }).select('id');
    if (newM && newM.length > 0) machineId = newM[0].id;
    else { console.error('Failed to get/create machine', errM); return; }
  }

  // Generate Image Link
  const { uploadToSupabase } = await import('../backend/services/supabase_storage.service');
  const { generateReportPDF, generateSummaryPDF } = await import('../backend/services/pdf.service');

  console.log('Subiendo foto...');
  const imgPath = path.join(process.cwd(), '..', '.gemini', 'antigravity', 'brain', 'c763c87f-2440-4d54-84ca-3fce452a0b4a', 'incubator_example_1775431302827.png');
  let photoBuf: Buffer;
  try {
    photoBuf = fs.readFileSync(imgPath);
  } catch (e) {
    console.log('Photo not found, fallback to placeholder.');
    photoBuf = Buffer.from('placeholder');
  }

  const photoResult = await uploadToSupabase(photoBuf, userName, 'photos', 'image/png', 'inc-1');

  // Generate PDF Individual
  console.log('Generando PDF Individual...');
  const indivPdf = await generateReportPDF(
    { tipo: 'INCUBADORA', numero_maquina: 1 },
    { nombre: userName },
    { temperature: '99.5', humidity: '53.0', processStatus: 'NORMAL' },
    photoBuf
  );
  const pdfIndivResult = await uploadToSupabase(indivPdf, userName, 'reports', 'application/pdf');

  // Insert to HourlyLog and Report
  const now = new Date();
  
  await supabase.from('HourlyLog').insert({
    user_id: userId,
    machine_id: machineId,
    fecha_hora: now.toISOString(),
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
    observaciones: 'Reporte Semilla (Ejemplo UI)',
  });

  await supabase.from('Report').insert({
    machine_id: machineId,
    user_id: userId,
    fecha_hora: now.toISOString(),
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
    processStatus: 'NORMAL',
    imageUrl: photoResult.publicUrl,
    pdfUrl: pdfIndivResult.publicUrl,
    temperature: 99.5,
    humidity: 53.0,
    observaciones: 'Reporte Semilla (Ejemplo UI)',
  });

  console.log('Reporte individual guardado.');

  // Generate Closing PDF
  console.log('Generando PDF Cierre...');
  const closingPdf = await generateSummaryPDF(userName, 'Turno Demostracion', [
    {
      fecha_hora: now,
      temp_principal_actual: 99.5,
      temp_secundaria_actual: 99.8,
      co2_actual: 300,
      is_na: false,
      observaciones: 'Reporte Semilla (Ejemplo UI)',
      machine: { tipo: 'INCUBADORA', numero_maquina: 1 }
    }
  ]);
  const pdfClosingResult = await uploadToSupabase(closingPdf, userName, 'reports', 'application/pdf');

  await supabase.from('Report').insert({
    machine_id: machineId,
    user_id: userId,
    fecha_hora: new Date(now.getTime() + 1000).toISOString(),
    isClosingReport: true,
    pdfUrl: pdfClosingResult.publicUrl,
    observaciones: 'Cierre de Turno Semilla (Demostracion)'
  });

  console.log('Reporte cierre guardado. DB sembrada.');
}

seedViaRest().catch(console.error);
