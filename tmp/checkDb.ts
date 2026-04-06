import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const machines = await prisma.machine.findMany();
    console.log('CONEXIÓN EXITOSA. MÁQUINAS:', machines.length);
  } catch (e: any) {
    console.error('ERROR DE CONEXIÓN:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
