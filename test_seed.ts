import { db } from './backend/firebase';

async function runSeed() {
  console.log('Iniciando carga de datos dummy en Firebase RTDB...');

  try {
    const dummyPhoto1 = 'https://picsum.photos/id/237/400/300';
    const dummyPhoto2 = 'https://picsum.photos/id/1025/400/300';
    const dummyPdf = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
    
    // 1. Simular máquinas con reportes y fotos
    await db.ref('machines/inc-1').set({
      tipo: 'INCUBADORA',
      numero_maquina: 1,
      last_photo: dummyPhoto1,
      last_temp: 37.5,
      last_hum: 55,
      status: 'completed',
      updated_at: new Date().toISOString()
    });

    await db.ref('machines/nac-1').set({
      tipo: 'NACEDORA',
      numero_maquina: 1,
      last_photo: dummyPhoto2,
      last_temp: 36.8,
      last_hum: 60,
      status: 'completed',
      updated_at: new Date().toISOString()
    });

    console.log('✅ Máquinas inc-1 y nac-1 insertadas con fotos.');

    // 2. Simular un reporte histórico con PDF anexado (imaginando que la UI buscará el enlace al pdf)
    const newReportRef = db.ref('reports').push();
    await newReportRef.set({
      machine_id: 'inc-1',
      user_name: 'Robot Seeder',
      photo_url: dummyPhoto1,
      document_url: dummyPdf, // PDF DE EJEMPLO
      temp_actual: 37.5,
      humedad_actual: 55,
      timestamp: new Date().toISOString(),
      data: {
         observaciones: 'Reporte de prueba automático para validación del gerente.'
      }
    });

    console.log(`✅ Reporte de prueba insertado con ref /reports/${newReportRef.key} y PDF.`);
    
    console.log('Carga finalizada con éxito.');
    process.exit(0);
  } catch (error) {
    console.error('Error insertando dummy data:', error);
    process.exit(1);
  }
}

runSeed();
