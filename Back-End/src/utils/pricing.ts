// Pricing & ETA utility
// Calculates subtotal, delivery fee based on distance tiers, VAT, discounts, and expected timing.

export interface PricingInputItem {
  price: number; // unit price THB
  qty: number;
}
export interface PricingInput {
  items: PricingInputItem[];
  distanceKm?: number; // customer distance
  deliveryType: 'delivery' | 'pickup';
  providedDeliveryFee?: number; // optional override from admin
  now?: Date; // for testing determinism
}
export interface PricingResult {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  tax: number; // VAT amount in THB
  total: number;
  vatRate: number;
  expectedReadyAt: Date; // when kitchen likely done
  expectedDeliveryAt?: Date; // when user likely receives (delivery only)
}

// Default config (can later source from DB or env)
const DEFAULT_VAT_RATE = Number(process.env.THAI_VAT_RATE || 0.07); // 7% default
const COOK_MINUTES_BASE = Number(process.env.ORDER_COOK_MINUTES || 15); // base cook time
const COOK_PER_ITEM_MIN = Number(process.env.ORDER_COOK_PER_ITEM_MIN || 2); // add 2 min per distinct line item
const DELIVERY_SPEED_KMPH = Number(process.env.DELIVERY_SPEED_KMPH || 30); // average rider speed

// Delivery fee tiers (distance upper bound inclusive)
// Can override via env DELIVERY_TIERS_JSON = '[{"maxKm":3,"fee":40},{"maxKm":6,"fee":60},{"maxKm":10,"fee":80},{"maxKm":9999,"fee":100}]'
let DELIVERY_FEE_TIERS: Array<{ maxKm: number; fee: number }> = [
  { maxKm: 3, fee: 40 },
  { maxKm: 6, fee: 60 },
  { maxKm: 10, fee: 80 },
  { maxKm: Infinity, fee: 100 },
];
try {
  if (process.env.DELIVERY_TIERS_JSON) {
    const parsed = JSON.parse(process.env.DELIVERY_TIERS_JSON);
    if (Array.isArray(parsed) && parsed.every(o => typeof o.maxKm === 'number' && typeof o.fee === 'number')) {
      DELIVERY_FEE_TIERS = parsed.sort((a,b)=>a.maxKm-b.maxKm);
    }
  }
} catch {
  // ignore malformed env, fallback defaults
}

// NOTE: FREE_DELIVERY_MIN read dynamically in computePricing so tests can mutate env at runtime.

export function calcDeliveryFee(distanceKm: number | undefined | null): number {
  const d = typeof distanceKm === 'number' && distanceKm >= 0 ? distanceKm : 0;
  for (const tier of DELIVERY_FEE_TIERS) {
    if (d <= tier.maxKm) return tier.fee;
  }
  return DELIVERY_FEE_TIERS[DELIVERY_FEE_TIERS.length - 1].fee;
}

export function computePricing(input: PricingInput): PricingResult {
  const now = input.now ? new Date(input.now) : new Date();
  const subtotal = input.items.reduce((s, it) => s + Math.max(0, Math.round(it.price)) * Math.max(1, Math.round(it.qty)), 0);
  let deliveryFee = input.deliveryType === 'delivery'
    ? (typeof input.providedDeliveryFee === 'number' ? input.providedDeliveryFee : calcDeliveryFee(input.distanceKm))
    : 0;
  const freeThreshold = Number(process.env.FREE_DELIVERY_MIN || 0);
  if (freeThreshold > 0 && subtotal >= freeThreshold && input.deliveryType === 'delivery') {
    deliveryFee = 0;
  }
  const discount = 0; // placeholder for future promotions
  const vatRate = DEFAULT_VAT_RATE;
  const taxableBase = subtotal + deliveryFee - discount;
  const tax = Math.round(taxableBase * vatRate);
  const total = subtotal + deliveryFee + tax - discount;

  // Cooking time estimation
  const cookMinutes = COOK_MINUTES_BASE + (input.items.length * COOK_PER_ITEM_MIN);
  const expectedReadyAt = new Date(now.getTime() + cookMinutes * 60_000);

  let expectedDeliveryAt: Date | undefined;
  if (input.deliveryType === 'delivery') {
    const km = input.distanceKm || 0;
    const hours = km / (DELIVERY_SPEED_KMPH || 30);
    const travelMinutes = Math.max(5, Math.round(hours * 60));
    expectedDeliveryAt = new Date(expectedReadyAt.getTime() + travelMinutes * 60_000);
  }

  return { subtotal, deliveryFee, discount, tax, total, vatRate, expectedReadyAt, expectedDeliveryAt };
}

export function formatEta(result: PricingResult) {
  return {
    readyMinutes: Math.round((result.expectedReadyAt.getTime() - Date.now()) / 60000),
    deliveryMinutes: result.expectedDeliveryAt ? Math.round((result.expectedDeliveryAt.getTime() - Date.now()) / 60000) : undefined,
    expectedReadyAt: result.expectedReadyAt,
    expectedDeliveryAt: result.expectedDeliveryAt,
  };
}
