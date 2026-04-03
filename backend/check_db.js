const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const count = await prisma.hourlyLog.count();
  console.log('Total HourlyLogs:', count);
  const latest = await prisma.hourlyLog.findMany({ orderBy: { fecha_hora: 'desc' }, take: 5, include: { machine: true } });
  console.log('Latest:', latest);
  
  const m = await prisma.machine.findMany();
  console.log('Machines:', m);
}

check().catch(console.error).finally(() => prisma.$disconnect());
