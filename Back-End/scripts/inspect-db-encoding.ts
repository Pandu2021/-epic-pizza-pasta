import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function main() {
  console.log('DATABASE_URL (from process.env):', process.env.DATABASE_URL);
  const prisma = new PrismaClient();
  try {
    const rows: any = await prisma.$queryRawUnsafe(`
      SELECT current_database() AS db,
             pg_encoding_to_char(encoding) AS encoding,
             datcollate, datctype
      FROM pg_database
      WHERE datname = current_database();
    `);
    console.log('Current DB info:', rows);
    const all: any = await prisma.$queryRawUnsafe(`
      SELECT datname, pg_encoding_to_char(encoding) AS enc
      FROM pg_database
      ORDER BY datname;
    `);
    console.log('All DB encodings:', all);
  } catch (e) {
    console.error('Failed to query encoding info:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
