import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
        where: { nombre: { contains: 'urno' } }
    });
    console.log('TURNEROS ENCONTRADOS:', JSON.stringify(users, null, 2));
    
    // Also check for most recent logs
    const recentLogs = await prisma.hourlyLog.findMany({
        orderBy: { fecha_hora: 'desc' },
        take: 5,
        include: { user: true, machine: true }
    });
    console.log('RECIENTES HOURLY LOGS:', JSON.stringify(recentLogs, null, 2));

  } catch (e: any) {
    console.error('ERROR AL CONSULTAR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
