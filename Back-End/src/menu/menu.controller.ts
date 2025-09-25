import { Controller, Get, Param, Query, Header } from '@nestjs/common';
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

export function loadJsonMenu(): JsonMenuItem[] {
  const tried: string[] = [];
  const candidates = [
    process.env.MENU_JSON_PATH, // explicit override
    path.join(__dirname, '../../prisma/seed/menu.json'), // TS runtime (tsx) path
    path.join(process.cwd(), 'prisma/seed/menu.json'), // root relative (prod build dist path)
    path.join(process.cwd(), 'dist/prisma/seed/menu.json'), // in case copied into dist
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try {
      tried.push(p);
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, 'utf8');
      const data = JSON.parse(raw) as JsonMenuItem[];
      return data.map((it) => ({
        ...it,
        images: it.images ?? (it.image ? [it.image] : []),
      }));
    } catch (e) {
      // continue to next candidate
    }
  }
  if (process.env.DEBUG_MENU_LOAD === 'true') {
    // eslint-disable-next-line no-console
    console.warn('[menu.loadJsonMenu] failed to load menu JSON. Tried:', tried);
  }
  return [];
}

// Simple in-memory cache for menu responses (process-local)
type CacheEntry<T> = { data: T; at: number; hit: boolean };
const CACHE_TTL_MS = Number(process.env.MENU_CACHE_TTL_MS || 60_000); // default 60s
const listCache = new Map<string, CacheEntry<any[]>>();
const searchCache = new Map<string, CacheEntry<any[]>>();

function getCache<K>(map: Map<string, CacheEntry<K>>, key: string): CacheEntry<K> | undefined {
  const it = map.get(key);
  if (!it) return undefined;
  if (Date.now() - it.at > CACHE_TTL_MS) {
    map.delete(key);
    return undefined;
  }
  return { ...it, hit: true };
}

function setCache<K>(map: Map<string, CacheEntry<K>>, key: string, data: K): CacheEntry<K> {
  const entry: CacheEntry<K> = { data, at: Date.now(), hit: false };
  map.set(key, entry);
  return entry;
}

@Controller('api/menu')
export class MenuController {
  @Get()
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=30')
  async list(@Query('category') category?: string) {
    const key = category ? `list:${category}` : 'list:all';
    const cached = getCache<any[]>(listCache, key);
    if (cached) {
      (global as any).console?.debug?.(`[menu.cache] HIT ${key}`);
      return cached.data;
    }
    const where = category ? { category } : ({} as any);
    const items = await prisma.menuItem.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        category: true,
        name: true,
        description: true,
        images: true,
        priceL: true,
        priceXL: true,
        basePrice: true,
        updatedAt: true,
      }
    });
    if (items.length > 0) {
      setCache(listCache, key, items);
      return items;
    }
    // Fallback to JSON if DB empty or seeding failed
    const json = loadJsonMenu();
    const data = category ? json.filter((m) => m.category === category) : json;
    setCache(listCache, key, data);
    return data;
  }

  @Get(':id')
  async get(@Param('id') id: string) {
  const item = await prisma.menuItem.findUnique({
    where: { id },
    select: {
      id: true,
      category: true,
      name: true,
      description: true,
      images: true,
      priceL: true,
      priceXL: true,
      basePrice: true,
      updatedAt: true,
    }
  });
  if (item) return item;
  const json = loadJsonMenu();
  return json.find((m) => m.id === id) ?? null;
  }

  @Get('search')
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=15')
  async search(@Query('q') q?: string, @Query('lang') lang: string = 'en') {
    const query = (q ?? '').trim();
    if (!query) return [];
    const key = `search:${lang}:${query.toLowerCase()}`;
    const cached = getCache<any[]>(searchCache, key);
    if (cached) {
      (global as any).console?.debug?.(`[menu.cache] HIT ${key}`);
      return cached.data;
    }
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
      setCache(searchCache, key, res);
      return res;
    }
    // Fallback to JSON
    const json = loadJsonMenu();
    const res = json.filter((m) => {
      const name = typeof m.name === 'object' ? (m.name[lang] ?? m.name['en'] ?? '') : (m.name ?? '');
      const desc = typeof m.description === 'object' ? (m.description[lang] ?? m.description['en'] ?? '') : (m.description ?? '');
      const hay = [m.id, m.category, name, desc].join(' ').toLowerCase();
      return tokens.every((tk) => hay.includes(tk));
    });
    setCache(searchCache, key, res);
    return res;
  }
}
