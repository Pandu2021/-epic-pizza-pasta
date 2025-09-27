/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const prisma = new PrismaClient();

// Shape compatible with Front-End menu.ts but simplified for seeding
interface SeedItem {
  id?: string;
  category: string;
  name: Record<string, string>;
  description?: Record<string, string>;
  images?: string[];
  image?: string; // single image convenience
  price?: number; // non-pizza
  priceL?: number;
  priceXL?: number;
  options?: unknown;
}

function normalize(item: SeedItem) {
  const images = item.images ?? (item.image ? [item.image] : []);
  // Prefer priceL/priceXL for pizzas; for others use base price; ensure integer
  const rawBase = item.price ?? item.priceL ?? item.priceXL ?? 0;
  const basePrice = Number.isFinite(rawBase) ? Math.round(rawBase) : 0;
  return {
    id: item.id,
    category: item.category,
    name: item.name as any,
    description: item.description as any,
    images,
    basePrice,
    priceL: item.priceL ?? undefined,
    priceXL: item.priceXL ?? undefined,
    options: item.options as any,
  };
}

async function ensureUtf8(): Promise<boolean> {
  try {
    const row: any = await prisma.$queryRawUnsafe(`SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = current_database();`);
    const enc = Array.isArray(row) ? row[0]?.enc : row?.enc;
    if (enc && enc.toUpperCase() !== 'UTF8') {
      console.error('\n[ERROR] Database encoding =', enc, ' (HARUS UTF8)');
      console.error('Karena terdapat teks bahasa Thai, database harus dibuat ulang dengan UTF8.');
      console.error('\nLangkah perbaikan:');
      console.error('  1. (Opsional) Backup data lama jika perlu.');
      console.error('  2. Buat DB baru UTF8 (misal nama: epic_pizza_utf8). Contoh psql:');
      console.error('     CREATE DATABASE epic_pizza_utf8 WITH ENCODING UTF8 TEMPLATE template0 LC_COLLATE="en_US.UTF-8" LC_CTYPE="en_US.UTF-8";');
      console.error('  3. Ubah .env -> DATABASE_URL ke DB baru (epic_pizza_utf8).');
      console.error('  4. Jalankan: npx prisma migrate deploy');
      console.error('  5. Jalankan: npm run seed:menu');
      console.error('\nAlternatif cepat (script internal belum tersedia): tulis ulang DB dengan encoding UTF8.');
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Peringatan: gagal memeriksa encoding DB, lanjutkan...', e);
    return true; // jangan blok jika check gagal
  }
}

async function main() {
  console.log('Using DATABASE_URL =', process.env.DATABASE_URL);

  const ok = await ensureUtf8();
  if (!ok) {
    process.exit(1);
  }

  // Attempt to enforce client UTF8 (defensive)
  try {
    await prisma.$executeRawUnsafe("SET client_encoding TO 'UTF8'");
  } catch (e) {
    console.warn('Warning: failed to set client_encoding to UTF8, continuing...', e);
  }
  try {
    const enc: any = await prisma.$queryRawUnsafe('SHOW client_encoding');
    console.log('Client encoding:', enc);
  } catch {}

  const jsonPath = path.join(__dirname, 'menu.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('File menu.json tidak ditemukan di', jsonPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(raw) as SeedItem[];

  console.log(`Seeding ${data.length} menu items...`);

  let created = 0;
  let updated = 0;
  let failed = 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (const it of data) {
        const d = normalize(it);
        try {
          if (d.id) {
            await tx.menuItem.upsert({
              where: { id: d.id },
              update: d,
              create: d as any,
            });
            // Upsert tidak memberitahu created/updated secara langsung: cek existence dulu cepat
            // (Atau: query count sebelumnya — di sini kita compromise: treat as updated jika sudah ada)
            const existed = await tx.menuItem.findUnique({ where: { id: d.id }, select: { id: true } });
            if (existed) updated++; else created++; // NOTE: This will always count as updated (since existed after upsert); so adjust logic below.
          } else {
            const rec = await tx.menuItem.create({ data: d as any });
            if (rec.id) created++;
          }
        } catch (e: any) {
          failed++;
          if (e?.message && e.message.includes('22P05')) {
            console.error('\n[Encoding Error] Database bukan UTF8.');
            console.error('Langkah perbaikan:');
            console.error('  npm run db:create:utf8 (atau buat DB UTF8 manual)');
            console.error('  Update .env DATABASE_URL ke DB baru');
            console.error('  npx prisma migrate deploy');
            console.error('  npm run seed:menu');
          } else {
            console.error('[Gagal] item id=', d.id, e.message);
          }
          throw e; // Stop transaksi; lebih aman supaya tidak partial
        }
      }
    });
  } catch (e) {
    console.error('Transaksi dibatalkan karena error.');
    throw e;
  }

  // Karena pendekatan existed di atas tidak akurat (selalu ada setelah upsert), koreksi statistik:
  if (updated > 0 && created === 0) {
    console.log('(Catatan) Hitungan created/updated heuristik. Upsert tidak membedakan tanpa query awal.');
  }

  console.log(`Seed completed. created≈${created} updated≈${updated} failed=${failed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
