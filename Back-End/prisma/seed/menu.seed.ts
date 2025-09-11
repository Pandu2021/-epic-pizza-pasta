import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

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
  // Prefer priceL/priceXL for pizzas; for others use base price
  const basePrice = item.price ?? item.priceL ?? item.priceXL ?? 0;
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

async function main() {
  // Ensure UTF-8 client encoding on Windows to avoid WIN1252 conversion errors
  try {
    await prisma.$executeRawUnsafe("SET client_encoding TO 'UTF8'");
  } catch (e) {
    console.warn('Warning: failed to set client_encoding to UTF8, continuing...', e);
  }

  const jsonPath = path.join(__dirname, 'menu.json');
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(raw) as SeedItem[];

  console.log(`Seeding ${data.length} menu items...`);

  await prisma.$transaction(async (tx) => {
    try {
      await tx.$executeRawUnsafe("SET client_encoding TO 'UTF8'");
    } catch {}

    for (const it of data) {
      const d = normalize(it);
      if (d.id) {
        await tx.menuItem.upsert({
          where: { id: d.id },
          update: d,
          create: d as any,
        });
      } else {
        await tx.menuItem.create({ data: d as any });
      }
    }
  });

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
