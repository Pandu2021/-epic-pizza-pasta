import { describe, it, expect } from 'vitest';
import { computePricing, calcDeliveryFee } from './pricing';

describe('pricing', () => {
  it('calculates delivery fee tiers', () => {
    expect(calcDeliveryFee(0)).toBe(40);
    expect(calcDeliveryFee(3)).toBe(40);
    expect(calcDeliveryFee(4)).toBe(60);
    expect(calcDeliveryFee(7)).toBe(80);
    expect(calcDeliveryFee(50)).toBe(100);
  });

  it('computes subtotal, tax and total with VAT', () => {
    const res = computePricing({ items: [{ price: 100, qty: 2 }], deliveryType: 'delivery', distanceKm: 2 });
    expect(res.subtotal).toBe(200);
    expect(res.deliveryFee).toBeGreaterThan(0);
    expect(res.tax).toBeGreaterThan(0);
    expect(res.total).toBe(res.subtotal + res.deliveryFee + res.tax - res.discount);
  });

  it('omits delivery fee for pickup', () => {
    const res = computePricing({ items: [{ price: 150, qty: 1 }], deliveryType: 'pickup' });
    expect(res.deliveryFee).toBe(0);
  });

  it('respects free delivery threshold when set', () => {
    process.env.FREE_DELIVERY_MIN = '300';
    const res = computePricing({ items: [{ price: 200, qty: 2 }], deliveryType: 'delivery', distanceKm: 5 });
    expect(res.subtotal).toBe(400);
    expect(res.deliveryFee).toBe(0);
    delete process.env.FREE_DELIVERY_MIN;
  });
});
