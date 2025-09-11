export type DeliveryTier = { maxKm: number; fee: number };

export const DEFAULT_TIERS: DeliveryTier[] = [
  { maxKm: 3, fee: 40 },
  { maxKm: 6, fee: 60 },
  { maxKm: Infinity, fee: 100 }
];

export function calcDeliveryFee(distanceKm: number, tiers: DeliveryTier[] = DEFAULT_TIERS) {
  for (const t of tiers) {
    if (distanceKm <= t.maxKm) return t.fee;
  }
  return tiers[tiers.length - 1]?.fee ?? 0;
}
