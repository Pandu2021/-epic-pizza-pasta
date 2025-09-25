import { describe, it, expect } from 'vitest';

// Simple pure function replicate logic used in metrics endpoint for unit testing
function calcStartOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

describe('metrics helpers', () => {
  it('start of day should zero time components', () => {
    const now = new Date('2025-09-24T15:23:45.123Z');
    const sod = calcStartOfDay(now);
    // startOfDay uses local timezone; verify local components are zero
    expect(sod.getHours()).toBe(0);
    expect(sod.getMinutes()).toBe(0);
    expect(sod.getSeconds()).toBe(0);
  });
});
