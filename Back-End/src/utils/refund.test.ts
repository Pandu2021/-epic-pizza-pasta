import { describe, it, expect } from 'vitest';
import { shouldRefund } from './refund';

describe('refund util', () => {
  it('refunds pending when cancelled', () => {
    expect(shouldRefund({ paymentStatus: 'pending', orderStatus: 'cancelled' })).toBe(true);
  });
  it('no refund if not cancelled', () => {
    expect(shouldRefund({ paymentStatus: 'pending', orderStatus: 'received' })).toBe(false);
  });
  it('no refund if no paymentStatus', () => {
    expect(shouldRefund({ orderStatus: 'cancelled' })).toBe(false);
  });
});