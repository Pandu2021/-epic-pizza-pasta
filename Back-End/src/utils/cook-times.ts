import { prisma } from '../prisma';

// Default typical cook times per category (minutes)
// You can override via COOK_TIMES_JSON env (e.g. [{"category":"pizza","minutes":16}])
const DEFAULT_COOK_MAP: Record<string, number> = {
  pizza: 15,
  pasta: 10,
  appetizer: 8,
  salad: 5,
  dessert: 6,
  drink: 2,
};

function loadCookMap(): Record<string, number> {
  const raw = process.env.COOK_TIMES_JSON;
  if (!raw) return { ...DEFAULT_COOK_MAP };
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      const m: Record<string, number> = { ...DEFAULT_COOK_MAP };
      for (const it of arr) {
        const cat = String(it.category || '').toLowerCase();
        const min = Number(it.minutes);
        if (cat && Number.isFinite(min) && min > 0) m[cat] = min;
      }
      return m;
    }
  } catch {
    // ignore malformed
  }
  return { ...DEFAULT_COOK_MAP };
}

export type MenuQty = { id: string; qty: number };

// Heuristic: the slowest item dictates kitchen ready time, with small overhead for multiple lines/quantities.
// Tunables via env:
//  - COOK_BASE_MIN (default 5)
//  - COOK_PER_EXTRA_QTY_MIN (default 2)
//  - COOK_PER_EXTRA_LINE_MIN (default 1)
export async function estimateCookMinutesByMenuIds(items: MenuQty[]): Promise<number> {
  if (!items.length) return 0;
  const cookMap = loadCookMap();
  const base = Number(process.env.COOK_BASE_MIN || 5);
  const perExtraQty = Number(process.env.COOK_PER_EXTRA_QTY_MIN || 2);
  const perExtraLine = Number(process.env.COOK_PER_EXTRA_LINE_MIN || 1);
  const ids = Array.from(new Set(items.map(i => i.id)));
  const menu = await prisma.menuItem.findMany({ where: { id: { in: ids } }, select: { id: true, category: true } }) as Array<{ id: string; category: string | null }>;
  const catById: Map<string, string> = new Map(
    menu.map((m: { id: string; category: string | null }) => [m.id, (m.category ?? '').toLowerCase()])
  );

  let maxItem = 0;
  let lines = 0;
  for (const it of items) {
    const cat: string = catById.get(it.id) || '';
    const baseCat = (cat && Object.prototype.hasOwnProperty.call(cookMap, cat)) ? cookMap[cat] : (cookMap['pizza'] ?? 12); // fallback
    const qty = Math.max(1, Math.round(it.qty || 1));
    const thisItem = baseCat + perExtraQty * (qty - 1);
    maxItem = Math.max(maxItem, thisItem);
    lines += 1;
  }
  const overhead = perExtraLine * Math.max(0, lines - 1);
  return base + maxItem + overhead;
}
