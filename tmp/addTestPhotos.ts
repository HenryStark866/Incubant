import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function addTestPhotos() {
  // Sanitizar la URL: eliminar caracteres ocultos y espacios
  const dbUrl = (process.env.DATABASE_URL || '').replace(/\r/g, '').trim().replace(/^"(.*)"$/, '$1');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

  try {
    console.log('Conectando a la base de datos...');
    
    // Usamos un operario predefinido que sabemos que existe
    const userId = 'juan-suaza';
    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user) {
        console.error(`No se encontró el usuario ${userId}. Verifique el seeding.`);
        return;
    }

    const machines = await prisma.machine.findMany();
    console.log(`Encontradas ${machines.length} máquinas.`);

    const now = new Date();
    // Forzamos una fecha muy reciente para que aparezca como "hace pocos min"
    const timestamp = new Date();

    for (const machine of machines) {
        const seed = Math.floor(Math.random() * 10000);
        // Cada máquina tiene una imagen de prueba distinta
        const photoUrl = `https://picsum.photos/seed/${machine.id}_${seed}/800/1200`;

        await prisma.hourlyLog.create({
            data: {
                machine_id: machine.id,
                user_id: user.id,
                fecha_hora: timestamp,
                photo_url: photoUrl,
                temp_principal_actual: 37.5 + (Math.random() * 0.4 - 0.2),
                temp_principal_consigna: 37.5,
                co2_actual: 1200 + (Math.random() * 200 - 100),
                co2_consigna: 1200,
                humedad_actual: 55.0 + (Math.random() * 2 - 1),
                humedad_consigna: 55.0,
                temp_secundaria_actual: 36.8 + (Math.random() * 0.4 - 0.2),
                temp_secundaria_consigna: 36.8,
                observaciones: `Reporte de prueba VISUAL para ${machine.id}`
            }
        });
        console.log(`✅ Foto agregada para ${machine.id}`);
    }

    console.log('\n✨ TODO LISTO: Las tarjetas del panel administrativo deberían mostrar ahora estas imágenes de prueba.');

  } catch (error) {
    console.error('Error crítico al agregar fotos de prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestPhotos();
