import { describe, it, expect } from 'vitest';
import { normalizeThaiPhone, isValidThaiPhone } from './phone';

describe('phone utils', () => {
  it('validates Thai phone formats', () => {
    expect(isValidThaiPhone('0812345678')).toBe(true);
    expect(isValidThaiPhone('+66812345678')).toBe(true);
  expect(isValidThaiPhone('+6612345678')).toBe(true);
    expect(isValidThaiPhone('081-234-5678')).toBe(true);
    expect(isValidThaiPhone('081 234 5678')).toBe(true);
  });

  it('normalizes to +66E.164 style for local numbers', () => {
    expect(normalizeThaiPhone('0812345678')).toBe('+66812345678');
    expect(normalizeThaiPhone('081-234-5678')).toBe('+66812345678');
    expect(normalizeThaiPhone('081 234 5678')).toBe('+66812345678');
  });

  it('keeps +66 numbers as-is', () => {
    expect(normalizeThaiPhone('+66812345678')).toBe('+66812345678');
  });
});
