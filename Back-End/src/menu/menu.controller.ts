import { Controller, Get, Param, Query, Header, Headers, Res } from '@nestjs/common';
import { prisma } from '../prisma';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Response } from 'express';

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
  basePrice?: number; // derived for fallback parity with DB schema
};

// Memoized JSON menu loader (fallback only)
let _jsonMenuCache: { data: JsonMenuItem[]; at: number } | null = null;
// Sentinel to remember if DB menu table appears empty so we can skip DB calls for a short TTL
let _dbEmptySince: number | null = null;
const DB_EMPTY_TTL_MS = 5 * 60_000; // 5 minutes before re-checking
export function loadJsonMenu(): JsonMenuItem[] {
  const TTL = Number(process.env.MENU_JSON_TTL_MS || 5 * 60_000); // 5 minutes default
  if (_jsonMenuCache && Date.now() - _jsonMenuCache.at < TTL) {
    return _jsonMenuCache.data;
  }
  const tried: string[] = [];
  const candidates = [
    process.env.MENU_JSON_PATH,
    path.join(__dirname, '../../prisma/seed/menu.json'),
    path.join(process.cwd(), 'prisma/seed/menu.json'),
    path.join(process.cwd(), 'dist/prisma/seed/menu.json'),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try {
      tried.push(p);
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, 'utf8');
      const data = (JSON.parse(raw) as JsonMenuItem[]).map((it) => ({
        ...it,
        images: it.images ?? (it.image ? [it.image] : []),
        // Provide basePrice like seed logic so FE has consistent field when DB empty
        basePrice: it.basePrice ?? it.price ?? it.priceL ?? it.priceXL ?? 0,
      }));
      _jsonMenuCache = { data, at: Date.now() };
      return data;
    } catch {
      // continue
    }
  }
  if (process.env.DEBUG_MENU_LOAD === 'true') {
    console.warn('[menu.loadJsonMenu] failed to load menu JSON. Tried:', tried);
  }
  _jsonMenuCache = { data: [], at: Date.now() };
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

function computeListEtag(items: any[], category?: string): string {
  try {
    if (!items || items.length === 0) return `empty-${category || 'all'}`;
    // If updatedAt missing (JSON fallback) derive hash from ids and basePrices for stability
    const updatedTimestamps: number[] = [];
    let hasUpdated = false;
    for (const it of items) {
      if (it.updatedAt) {
        hasUpdated = true;
        updatedTimestamps.push(new Date(it.updatedAt).getTime());
      }
    }
    let base: string;
    if (hasUpdated) {
      const maxTs = Math.max(...updatedTimestamps);
      base = `${category || 'all'}:${items.length}:${maxTs}`;
    } else {
      const sig = items.map(i => `${i.id}:${i.basePrice ?? ''}`).join('|');
      base = `${category || 'all'}:${items.length}:${crypto.createHash('sha1').update(sig).digest('hex').slice(0,8)}`;
    }
    return crypto.createHash('sha1').update(base).digest('base64url').slice(0, 16);
  } catch {
    return `fallback-${category || 'all'}`;
  }
}

const DB_FETCH_TIMEOUT_MS = Number(process.env.MENU_DB_TIMEOUT_MS || 4000); // default 4s before fallback
async function fetchDbMenu(category?: string) {
  // Skip DB if previously detected empty and TTL not expired
  if (_dbEmptySince && Date.now() - _dbEmptySince < DB_EMPTY_TTL_MS) return null;
  const where = category ? { category } : ({} as any);
  const dbPromise = prisma.menuItem.findMany({
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
  let items: any[] | null = null;
  try {
    // Race DB query vs timeout so production (cold DB / sleeping instance) does not block user for ~60s
    items = await Promise.race([
      dbPromise,
      new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('MENU_DB_TIMEOUT')), DB_FETCH_TIMEOUT_MS)),
    ]);
  } catch (e: any) {
    if (e?.message === 'MENU_DB_TIMEOUT') {
      if (process.env.DEBUG_MENU_TIMING === 'true') console.warn('[menu.fetchDbMenu] timeout', { ms: DB_FETCH_TIMEOUT_MS });
      return null; // fallback to JSON
    }
    if (process.env.DEBUG_MENU_TIMING === 'true') console.warn('[menu.fetchDbMenu] prisma error', e);
    return null;
  }
  if (!items || items.length === 0) {
    _dbEmptySince = Date.now();
    return null;
  }
  return items;
}

function logTiming(label: string, start: number, extra: Record<string, any> = {}) {
  if (process.env.DEBUG_MENU_TIMING === 'true') {
    const dur = Date.now() - start;
    console.log(`[menu.timing] ${label} ${dur}ms`, extra);
  }
}

@Controller('api/menu')
export class MenuController {
  @Get()
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=30')
  async list(
    @Query('category') category?: string,
    @Headers('if-none-match') ifNoneMatch?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const key = category ? `list:${category}` : 'list:all';
    const start = Date.now();
    const cached = getCache<any[]>(listCache, key);
    let items: any[] | undefined = cached?.data;
    if (!items) {
      const dbStart = Date.now();
      const dbItems = await fetchDbMenu(category);
      if (dbItems) items = dbItems as any[];
      logTiming('dbFetch', dbStart, { category, found: (items && items.length) || 0 });
      if (!dbItems) {
        const jsonStart = Date.now();
        const json = loadJsonMenu();
        items = category ? json.filter((m) => m.category === category) : json;
        logTiming('jsonLoad', jsonStart, { category, size: items.length });
        if (process.env.DEBUG_MENU_TIMING === 'true') {
          console.warn('[menu.list] Falling back to JSON menu (DB empty/timeout) key=' + key + ' size=' + items.length);
        }
      }
      // If DB timed out previously, optionally schedule background refresh (non-blocking) to hydrate cache next time
      if (!cached && !dbItems) {
        // Fire and forget (no await) to attempt DB populate for next call
        (async () => {
          try {
            const late = await fetchDbMenu(category);
            if (late) setCache(listCache, key, late);
          } catch {}
        })();
      }
      setCache(listCache, key, items);
    }
    const etagRaw = computeListEtag(items || [], category);
    const etag = `W/"menu-${etagRaw}"`;
    if (res) res.setHeader('ETag', etag);
    if (ifNoneMatch && ifNoneMatch === etag) {
      if (res) res.status(304);
      if (process.env.DEBUG_MENU_TIMING === 'true') {
        console.log(`[menu.list] 304 NOT MODIFIED key=${key} in ${Date.now() - start}ms`);
      }
      return;
    }
    logTiming('listHandler', start, { key, size: items?.length, cacheHit: !!cached });
    return items;
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
    const dbStart = Date.now();
    const dbItems = await prisma.menuItem.findMany({
      select: { id: true, category: true, name: true, description: true, priceL: true, priceXL: true, basePrice: true, images: true, updatedAt: true }
    });
    logTiming('search.dbFetch', dbStart, { size: dbItems.length });
    if (dbItems.length > 0) {
      const filterStart = Date.now();
      const res = dbItems.filter((m: any) => {
        const name = typeof m.name === 'object' ? (m.name[lang] ?? m.name['en'] ?? '') : m.name ?? '';
        const desc = typeof m.description === 'object' ? (m.description[lang] ?? m.description['en'] ?? '') : m.description ?? '';
        const hay = [m.id, m.category, name, desc].join(' ').toLowerCase();
        return tokens.every((tk) => hay.includes(tk));
      });
      logTiming('search.filterDb', filterStart, { tokens: tokens.length, result: res.length });
      setCache(searchCache, key, res);
      return res;
    }
    // Fallback to JSON
    const json = loadJsonMenu();
    const filterStart = Date.now();
    const res = json.filter((m) => {
      const name = typeof m.name === 'object' ? (m.name[lang] ?? m.name['en'] ?? '') : (m.name ?? '');
      const desc = typeof m.description === 'object' ? (m.description[lang] ?? m.description['en'] ?? '') : (m.description ?? '');
      const hay = [m.id, m.category, name, desc].join(' ').toLowerCase();
      return tokens.every((tk) => hay.includes(tk));
    });
    logTiming('search.filterJson', filterStart, { tokens: tokens.length, result: res.length });
    setCache(searchCache, key, res);
    return res;
  }
}
