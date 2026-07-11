import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const getDatabaseUrl = () => {
  if (process.env.DIRECT_URL) {
    return process.env.DIRECT_URL;
  }
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.includes('-pooler')) {
    return dbUrl.replace('-pooler', '');
  }
  return dbUrl;
};

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
