const STORAGE_KEY = 'epic-pizza-guest-orders';

export type GuestSessionRecord = {
  orderId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function parseSessions(): GuestSessionRecord[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => Boolean(entry?.orderId && entry?.token && entry?.expiresAt && entry?.createdAt));
  } catch {
    return [];
  }
}

function persistSessions(records: GuestSessionRecord[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // ignore storage failures (e.g. private browsing quota)
  }
}

export function purgeExpiredGuestSessions(referenceDate: Date = new Date()) {
  const now = referenceDate.getTime();
  const sessions = parseSessions();
  const filtered = sessions.filter((s) => {
    const expires = Date.parse(s.expiresAt);
    return Number.isFinite(expires) ? expires > now : false;
  });
  if (filtered.length !== sessions.length) {
    persistSessions(filtered);
  }
  return filtered;
}

type RememberArgs = {
  orderId: string;
  token: string;
  expiresAt: string;
};

export function rememberGuestSession(args: RememberArgs) {
  const { orderId, token, expiresAt } = args;
  if (!orderId || !token || !expiresAt) return;
  const createdAt = new Date().toISOString();
  const sessions = purgeExpiredGuestSessions();
  const updated = sessions.filter((s) => s.orderId !== orderId && s.token !== token);
  updated.unshift({ orderId, token, expiresAt, createdAt });
  persistSessions(updated.slice(0, 5));
}

type FindArgs = { orderId?: string | null; token?: string | null };

export function findGuestSession(args?: FindArgs): GuestSessionRecord | null {
  const sessions = purgeExpiredGuestSessions();
  if (!sessions.length) return null;
  if (args?.token) {
    const byToken = sessions.find((s) => s.token === args.token);
    if (byToken) return byToken;
  }
  if (args?.orderId) {
    const byOrder = sessions.find((s) => s.orderId === args.orderId);
    if (byOrder) return byOrder;
  }
  return sessions[0];
}