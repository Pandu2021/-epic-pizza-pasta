#!/usr/bin/env tsx
import 'dotenv/config';
// Use dynamic require to avoid TS resolution issues with pg's ESM exports & missing d.ts
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg') as { Client: any };
import { URL } from 'node:url';

interface ParsedDbUrl {
  full: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  dbName: string;
}

function parseDatabaseUrl(dbUrl: string): ParsedDbUrl {
  const u = new URL(dbUrl);
  const dbName = (u.pathname || '/').replace(/^\//, '') || 'postgres';
  return {
    full: dbUrl,
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username || 'postgres'),
    password: decodeURIComponent(u.password || ''),
    dbName,
  };
}

async function databaseExists(client: any, name: string): Promise<boolean> {
  const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  return res.rowCount > 0;
}

async function getDbEncoding(client: any, name: string): Promise<string | null> {
  const res = await client.query('SELECT pg_encoding_to_char(encoding) enc FROM pg_database WHERE datname = $1', [name]);
  return res.rows[0]?.enc || null;
}

function buildAdminConnection(parsed: ParsedDbUrl): string {
  // Connect to postgres maintenance DB to create a new one
  const baseDb = 'postgres';
  const proto = parsed.full.startsWith('postgresql://') ? 'postgresql://' : 'postgres://';
  const auth = `${encodeURIComponent(parsed.user)}${parsed.password ? ':' + encodeURIComponent(parsed.password) : ''}`;
  return `${proto}${auth}@${parsed.host}:${parsed.port}/${baseDb}`;
}

function color(c: string, msg: string) { return `\x1b[${c}m${msg}\x1b[0m`; }
const green = (s: string) => color('32', s);
const yellow = (s: string) => color('33', s);
const red = (s: string) => color('31', s);
const cyan = (s: string) => color('36', s);

async function main() {
  const fromEnv = process.env.DATABASE_URL;
  if (!fromEnv) {
    console.error(red('ERROR: DATABASE_URL tidak ditemukan di environment.'));
    process.exit(1);
  }
  const parsed = parseDatabaseUrl(fromEnv);

  // Nama target baru bisa diberikan via argumen ke-2: npm run db:create:utf8 -- epic_pizza_utf8
  const argName = process.argv[2];
  const newName = argName || (parsed.dbName.endsWith('_utf8') ? parsed.dbName : parsed.dbName + '_utf8');
  if (newName === parsed.dbName) {
    console.log(yellow(`Nama database sumber (${parsed.dbName}) sudah mengandung _utf8. Gunakan argumen eksplisit bila ingin membuat ulang.`));
  }

  console.log(cyan('== Konfigurasi =='));
  console.log('Host     :', parsed.host);
  console.log('Port     :', parsed.port);
  console.log('User     :', parsed.user);
  console.log('DB Sumber:', parsed.dbName);
  console.log('DB Target:', newName);

  const adminConn = buildAdminConnection(parsed);
  const admin = new Client({ connectionString: adminConn });
  await admin.connect();

  try {
    const existsSource = await databaseExists(admin, parsed.dbName);
    if (!existsSource) {
      console.error(red(`Database sumber '${parsed.dbName}' tidak ada.`));
      process.exit(1);
    }
    const sourceEnc = await getDbEncoding(admin, parsed.dbName);
    console.log('Encoding sumber:', sourceEnc);

    const targetExists = await databaseExists(admin, newName);
    if (targetExists) {
      const targetEnc = await getDbEncoding(admin, newName);
      if (targetEnc?.toUpperCase() === 'UTF8') {
        console.log(green(`Database target '${newName}' sudah ada dengan encoding UTF8. Tidak membuat ulang.`));
        console.log(yellow('Langkah selanjutnya:'));
        console.log('  1. Update .env -> DATABASE_URL ke database target tersebut.');
        console.log('  2. Jalankan: npx prisma migrate deploy');
        console.log('  3. Jalankan: npm run seed:menu');
        return;
      } else {
        console.log(red(`Database target '${newName}' sudah ada tetapi encoding = ${targetEnc}.`));
        console.log('Hapus atau pilih nama lain, lalu jalankan ulang.');
        process.exit(1);
      }
    }

    console.log(cyan('Membuat database UTF8 baru...'));
    await admin.query(`CREATE DATABASE ${newName.replace(/"/g,'"')} WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE='en_US.UTF-8' LC_CTYPE='en_US.UTF-8'`);
    console.log(green(`Database '${newName}' berhasil dibuat.`));

    console.log(yellow('\nLangkah selanjutnya:'));
    console.log('  1. Update .env -> DATABASE_URL=postgresql://USER:PASS@HOST:PORT/' + newName + '?schema=public&client_encoding=utf8');
    console.log('  2. Jalankan: npx prisma migrate deploy');
    console.log('  3. Jalankan: npm run seed:menu');
  } finally {
    await admin.end();
  }
}

main().catch(err => {
  console.error(red('Gagal membuat database UTF8:'), err);
  process.exit(1);
});
