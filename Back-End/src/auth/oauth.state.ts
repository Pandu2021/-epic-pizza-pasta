// Simple in-memory OAuth state/nonce store with TTL to mitigate CSRF
// Note: This resets on server restart; good enough for our use case.

type StateRecord = {
	provider: 'google' | 'line';
	nonce: string;
	createdAt: number;
	redirectTo?: string | null;
};

const store = new Map<string, StateRecord>();
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

function randomId(bytes = 16) {
	return require('crypto').randomBytes(bytes).toString('hex');
}

export function createOAuthState(params: { provider: 'google' | 'line'; redirectTo?: string | null }): { state: string; nonce: string } {
	const state = randomId(16);
	const nonce = randomId(16);
	const record: StateRecord = {
		provider: params.provider,
		nonce,
		createdAt: Date.now(),
		redirectTo: params.redirectTo ?? null,
	};
	store.set(state, record);
	return { state, nonce };
}

export function consumeOAuthState(state: string, expectedProvider?: 'google' | 'line') {
	const rec = store.get(state);
	if (!rec) return null;
	const ttl = Number(process.env.OAUTH_STATE_TTL_MS || DEFAULT_TTL_MS);
	const expired = Date.now() - rec.createdAt > Math.max(60_000, ttl);
	store.delete(state);
	if (expired) return null;
	if (expectedProvider && rec.provider !== expectedProvider) return null;
	return rec;
}

