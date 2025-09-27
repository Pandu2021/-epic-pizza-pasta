/**
 * Normalize Thai phone numbers.
 * - Remove spaces and dashes
 * - Convert leading 0XXXXXXXXX to +66XXXXXXXXX
 * - Keep +66XXXXXXXX or +66XXXXXXXXX as-is
 */
export function normalizeThaiPhone(input: string): string {
  if (!input) return input;
  const raw = String(input).replace(/[\s-]/g, '');
  if (raw.startsWith('+66')) return raw;
  // 0 followed by 9 digits (total length 10)
  if (/^0\d{9}$/.test(raw)) return `+66${raw.slice(1)}`;
  return raw;
}

/**
 * Validate Thai phone numbers (accepts 0XXXXXXXXX or +66XXXXXXXX/XXXXXXXXX)
 */
export function isValidThaiPhone(input: string): boolean {
  if (!input) return false;
  const s = String(input).replace(/[\s-]/g, '');
  return /^(\+66\d{8,9}|0\d{9})$/.test(s);
}
