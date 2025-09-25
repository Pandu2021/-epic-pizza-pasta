import { describe, it, expect } from 'vitest';
import { computeProgress, shouldAutoConfirm } from './tracking';

describe('tracking utils', () => {
  it('progress 50% halfway', () => {
    const ordered = 0;
    const expected = 60_000; // 1 min
    const { ratio, remainingMs } = computeProgress({ orderedAt: ordered, expectedDeliveryAt: expected, now: 30_000 });
    expect(ratio).toBeCloseTo(0.5, 2);
    expect(remainingMs).toBe(30_000);
  });
  it('clamps over-complete', () => {
    const ordered = 0; const expected = 10_000;
    const { ratio, remainingMs } = computeProgress({ orderedAt: ordered, expectedDeliveryAt: expected, now: 20_000 });
    expect(ratio).toBe(1);
    expect(remainingMs).toBe(0);
  });
  it('auto confirm only after grace', () => {
    const expected = 100_000;
    expect(shouldAutoConfirm(false, expected, 100_000 + 4 * 60_000, 5)).toBe(false);
    expect(shouldAutoConfirm(false, expected, 100_000 + 5 * 60_000, 5)).toBe(true);
  });
});
