import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst();
  console.log('USER_ID:', user?.id);
  process.exit(0);
}
main();
