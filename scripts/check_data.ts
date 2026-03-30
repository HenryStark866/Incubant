import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('USERS_LIST_START');
  console.log(JSON.stringify(users, null, 2));
  console.log('USERS_LIST_END');
  
  const shifts = await prisma.shift.findMany();
  console.log('SHIFTS_LIST_START');
  console.log(JSON.stringify(shifts, null, 2));
  console.log('SHIFTS_LIST_END');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
