import { calcDeliveryFee } from './delivery';

describe('calcDeliveryFee', () => {
  it('applies correct tiers', () => {
    expect(calcDeliveryFee(2.5)).toBe(40);
    expect(calcDeliveryFee(4)).toBe(60);
    expect(calcDeliveryFee(10)).toBe(100);
  });
});
