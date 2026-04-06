import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function main() {
    const shifts = await prisma.shift.findMany();
    console.log(JSON.stringify(shifts, null, 2));
}

main().finally(() => prisma.$disconnect());
