import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Querying users...');
    const users = await prisma.user.findMany({
        select: {
            id: true,
            nombre: true,
            rol: true,
            pin_acceso: true
        }
    });
    console.log(JSON.stringify(users, null, 2));
}

main()
    .catch((e) => {
        console.error('Error querying users:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
