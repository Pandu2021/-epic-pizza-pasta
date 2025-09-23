/// <reference types="node" />
import { PrismaClient } from '@prisma/client';

// This script connects to the default 'postgres' database and creates
// a new database with UTF-8 encoding using template0 to avoid WIN1252 issues on Windows.

const DEFAULT_URL = process.env.DATABASE_URL || '';

function buildAdminUrl(url: string) {
  // Replace the database name with 'postgres' to obtain an admin connection
  // Simple approach: split before '?' and last path segment
  // Example: postgresql://user:pass@host:5432/db?schema=public
  const [base, query] = url.split('?');
  const idx = base.lastIndexOf('/');
  if (idx === -1) throw new Error('Invalid DATABASE_URL');
  const adminBase = base.substring(0, idx + 1) + 'postgres';
  return adminBase + (query ? '?' + query : '');
}

async function main() {
  const targetDb = process.env.NEW_DB_NAME || 'epic_pizza_utf8';
  if (!DEFAULT_URL) throw new Error('DATABASE_URL not set');
  const adminUrl = buildAdminUrl(DEFAULT_URL);

  // Instantiate Prisma with override datasource url
  const prisma = new PrismaClient({
    datasources: { db: { url: adminUrl } },
  });

  try {
    console.log('Connecting to admin database via:', adminUrl.replace(/:[^:@/]+@/, '://****@'));
    // Create DB with UTF8 encoding via template0
    const sql = `CREATE DATABASE ${targetDb} WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE='C' LC_CTYPE='C';`;
    await prisma.$executeRawUnsafe(sql);
    console.log(`Database '${targetDb}' created with UTF-8 encoding.`);
  } catch (e: any) {
    if (e?.message && /already exists/i.test(e.message)) {
      console.log(`Database '${targetDb}' already exists. Skipping.`);
    } else {
      console.error('Failed to create database:', e);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
