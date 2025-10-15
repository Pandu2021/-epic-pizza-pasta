import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const DEFAULT_MAX_RETRIES = 10;
const DEFAULT_RETRY_DELAY_MS = 2000;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForDatabaseConnection(): Promise<void> {
  const maxRetries = Number(process.env.DB_CONNECT_MAX_RETRIES || DEFAULT_MAX_RETRIES);
  const retryDelayMs = Number(process.env.DB_CONNECT_RETRY_DELAY_MS || DEFAULT_RETRY_DELAY_MS);

  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      await prisma.$queryRaw(Prisma.sql`SELECT 1`);
      if (attempt > 0) {
        console.log(`[database] connection established after ${attempt + 1} attempts.`);
      } else {
        console.log('[database] connection established.');
      }
      return;
    } catch (error) {
      attempt += 1;
      const message = error instanceof Error ? error.message : String(error);

      if (attempt > maxRetries) {
        console.error(`[database] connection failed after ${maxRetries + 1} attempts.`, error);
        throw error instanceof Error ? error : new Error(message);
      }

      console.warn(`[database] attempt ${attempt} failed: ${message}. Retrying in ${retryDelayMs}ms...`);
      await delay(retryDelayMs);
    }
  }
}
