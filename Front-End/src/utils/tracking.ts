export interface TrackingProgressInput {
  orderedAt: number;           // ms epoch when order placed
  expectedDeliveryAt?: number; // ms epoch expected delivery
  now?: number;                // override time for tests
}

export function computeProgress({ orderedAt, expectedDeliveryAt, now }: TrackingProgressInput) {
  const t = now ?? Date.now();
  if (!expectedDeliveryAt || expectedDeliveryAt <= orderedAt) return { ratio: 0, etaMs: 0, remainingMs: 0 };
  const total = expectedDeliveryAt - orderedAt;
  const elapsed = t - orderedAt;
  const clamped = Math.min(Math.max(elapsed, 0), total);
  const ratio = total === 0 ? 1 : clamped / total;
  const remainingMs = Math.max(expectedDeliveryAt - t, 0);
  return { ratio, etaMs: total, remainingMs };
}

export function shouldAutoConfirm(delivered: boolean, expectedDeliveryAt?: number, now: number = Date.now(), graceMinutes = 5) {
  if (delivered) return false; // already delivered
  if (!expectedDeliveryAt) return false;
  return now >= (expectedDeliveryAt + graceMinutes * 60_000);
}
