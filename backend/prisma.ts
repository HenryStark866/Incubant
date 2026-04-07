import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

/**
 * Unified Prisma Client singleton for the entire backend.
 * Sanitizes DATABASE_URL from process.env to avoid connection issues.
 */
export async function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    const { PrismaClient } = await import('@prisma/client');
    // Sanitizar la URL: eliminar caracteres ocultos (\r) y espacios
    const dbUrl = (process.env.DATABASE_URL || '').replace(/\r/g, '').trim().replace(/^"(.*)"$/, '$1');
    
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    });
  }
  return globalForPrisma.prisma;
}
