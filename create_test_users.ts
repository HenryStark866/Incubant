import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const testUser = await prisma.user.upsert({
    where: { pin_acceso: '1234' },
    update: {},
    create: {
      nombre: 'Test Operator',
      pin_acceso: '1234',
      rol: 'OPERARIO',
      turno: 'Turno 1'
    }
  });

  const testAdmin = await prisma.user.upsert({
    where: { pin_acceso: '0000' },
    update: {},
    create: {
      nombre: 'Test Admin',
      pin_acceso: '0000',
      rol: 'JEFE',
      turno: 'Admin'
    }
  });

  console.log('Test Users created:', { testUser, testAdmin });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
