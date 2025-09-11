import { Controller, Get, Param, Query } from '@nestjs/common';
import { prisma } from '../prisma';
import fs from 'fs';
import path from 'path';

type LocaleText = Record<string, string>;
type JsonMenuItem = {
  id: string;
  category: string;
  name: LocaleText | string;
  description?: LocaleText | string;
  images?: string[];
  image?: string;
  price?: number;
  priceL?: number;
  priceXL?: number;
  options?: unknown;
  labels?: string[];
};

function loadJsonMenu(): JsonMenuItem[] {
  try {
    const jsonPath = path.join(__dirname, '../../prisma/seed/menu.json');
    const raw = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(raw) as JsonMenuItem[];
    return data.map((it) => ({
      ...it,
      images: it.images ?? (it.image ? [it.image] : []),
    }));
  } catch {
    return [];
  }
}

@Controller('api/menu')
export class MenuController {
  @Get()
  async list(@Query('category') category?: string) {
  const where = category ? { category } : {} as any;
  const items = await prisma.menuItem.findMany({ where, orderBy: { updatedAt: 'desc' } });
  if (items.length > 0) return items;
  // Fallback to JSON if DB empty or seeding failed
  const json = loadJsonMenu();
  return category ? json.filter((m) => m.category === category) : json;
  }

  @Get(':id')
  async get(@Param('id') id: string) {
  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (item) return item;
  const json = loadJsonMenu();
  return json.find((m) => m.id === id) ?? null;
  }

  @Get('search')
  async search(@Query('q') q?: string, @Query('lang') lang: string = 'en') {
    const query = (q ?? '').trim();
    if (!query) return [];
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    // Try DB first
    const dbItems = await prisma.menuItem.findMany();
    if (dbItems.length > 0) {
      const res = dbItems.filter((m: any) => {
        const name = typeof m.name === 'object' ? (m.name[lang] ?? m.name['en'] ?? '') : m.name ?? '';
        const desc = typeof m.description === 'object' ? (m.description[lang] ?? m.description['en'] ?? '') : m.description ?? '';
        const hay = [m.id, m.category, name, desc].join(' ').toLowerCase();
        return tokens.every((tk) => hay.includes(tk));
      });
      return res;
    }
    // Fallback to JSON
    const json = loadJsonMenu();
    return json.filter((m) => {
      const name = typeof m.name === 'object' ? (m.name[lang] ?? m.name['en'] ?? '') : (m.name ?? '');
      const desc = typeof m.description === 'object' ? (m.description[lang] ?? m.description['en'] ?? '') : (m.description ?? '');
      const hay = [m.id, m.category, name, desc].join(' ').toLowerCase();
      return tokens.every((tk) => hay.includes(tk));
    });
  }
}
