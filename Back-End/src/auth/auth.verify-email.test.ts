import { describe, it, expect, beforeEach, vi } from 'vitest';

const { tokenStoreKey, userStoreKey, flagStoreKey } = vi.hoisted(() => ({
  tokenStoreKey: '__emailVerificationTokens__',
  userStoreKey: '__emailVerificationUsers__',
  flagStoreKey: '__emailVerificationFlags__',
}));

vi.mock('../prisma', () => {
  const tokenStore = ((globalThis as any)[tokenStoreKey] ||= []) as any[];
  const userStore = ((globalThis as any)[userStoreKey] ||= new Map<string, any>());
  const flags = ((globalThis as any)[flagStoreKey] ||= { missing: false }) as { missing: boolean };

  const ensureUser = (id: string) => {
    if (!userStore.has(id)) {
      userStore.set(id, {
        id,
        email: `${id}@example.com`,
        passwordHash: 'hash',
        role: 'customer',
        name: 'Test User',
        phone: null,
        lineUserId: null,
        refreshTokenHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerifiedAt: null,
      });
    }
    return userStore.get(id);
  };

  const missing = () => {
    if (!flags.missing) return;
    const err: any = new Error('EmailVerificationToken table missing');
    err.code = 'P2021';
    throw err;
  };

  const prismaMock = {
    emailVerificationToken: {
      create: vi.fn(async ({ data }: any) => {
        missing();
        const record = {
          id: data.id,
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          consumedAt: null,
          createdAt: new Date(),
        };
        tokenStore.push(record);
        return record;
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        missing();
        const userId = where?.userId;
        const excludeId = where?.id?.not as string | undefined;
        if (!userId) return { count: 0 };
        const keep = tokenStore.filter((token) => {
          if (token.userId !== userId) return true;
          if (excludeId && token.id === excludeId) return true;
          return false;
        });
        const removed = tokenStore.length - keep.length;
        tokenStore.splice(0, tokenStore.length, ...keep);
        return { count: removed };
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        missing();
        const record = tokenStore.find((token) => token.tokenHash === where.tokenHash);
        if (!record) return null;
        return {
          ...record,
          user: ensureUser(record.userId),
        };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        missing();
        const record = tokenStore.find((token) => token.id === where.id);
        if (!record) {
          const err: any = new Error('not found');
          err.code = 'P2025';
          throw err;
        }
        Object.assign(record, data);
        return record;
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => ensureUser(where.id)),
      update: vi.fn(async ({ where, data }: any) => {
        const user = ensureUser(where.id);
        Object.assign(user, data, { updatedAt: new Date() });
        return user;
      }),
    },
  };

  (globalThis as any)[tokenStoreKey] = tokenStore;
  (globalThis as any)[userStoreKey] = userStore;
  (globalThis as any)[flagStoreKey] = flags;

  return { prisma: prismaMock };
});

import { auth } from './auth.service';

const getStore = () => ((globalThis as any)[tokenStoreKey] ||= []) as any[];
const getUsers = () => ((globalThis as any)[userStoreKey] ||= new Map<string, any>()) as Map<string, any>;
const getFlags = () => ((globalThis as any)[flagStoreKey] ||= { missing: false }) as { missing: boolean };

describe('email verification token helpers', () => {
  beforeEach(() => {
    getStore().length = 0;
    getUsers().clear();
    const flags = getFlags();
    flags.missing = false;
    process.env.EMAIL_VERIFICATION_TOKEN_TTL_MS = `${60 * 60 * 1000}`; // 1 hour
  });

  it('creates and stores a hashed verification token', async () => {
    const { token, expiresAt } = await auth.generateEmailVerificationToken('user-verify-1');
    expect(token).toHaveLength(64);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    const saved = getStore();
    expect(saved).toHaveLength(1);
    expect(saved[0].userId).toBe('user-verify-1');
    expect(saved[0].tokenHash).toBe(auth.hashToken(token));
  });

  it('replaces previous tokens for the same user', async () => {
    const first = await auth.generateEmailVerificationToken('user-verify-2');
    const second = await auth.generateEmailVerificationToken('user-verify-2');
    expect(first.token).not.toBe(second.token);
    const saved = getStore();
    expect(saved).toHaveLength(1);
    expect(saved[0].tokenHash).toBe(auth.hashToken(second.token));
  });

  it('finds valid tokens and rejects expired ones', async () => {
    const { token } = await auth.generateEmailVerificationToken('user-verify-3');
    const valid = await auth.findValidEmailVerificationToken(token);
    expect(valid?.user.id).toBe('user-verify-3');

    const saved = getStore()[0];
    saved.expiresAt = new Date(Date.now() - 1000);
    const expired = await auth.findValidEmailVerificationToken(token);
    expect(expired).toBeNull();
  });

  it('marks the user as verified when consuming the token', async () => {
    const { token } = await auth.generateEmailVerificationToken('user-verify-4');
    const record = await auth.findValidEmailVerificationToken(token);
    expect(record).not.toBeNull();
    const verifiedAt = await auth.consumeEmailVerificationToken({ id: record!.id, userId: record!.userId, tokenHash: record!.tokenHash });
    const users = getUsers();
    expect(users.get('user-verify-4')?.emailVerifiedAt?.getTime()).toBeCloseTo(verifiedAt.getTime(), -2);
    const saved = getStore();
    expect(saved).toHaveLength(1);
    expect(saved[0].consumedAt).toBeInstanceOf(Date);
  });

  it('falls back to in-memory storage when the table is missing', async () => {
    const flags = getFlags();
    flags.missing = true;
    const { token } = await auth.generateEmailVerificationToken('user-verify-mem');
    const record = await auth.findValidEmailVerificationToken(token);
    expect(record?.user.id).toBe('user-verify-mem');
    await auth.consumeEmailVerificationToken({ id: record!.id, userId: record!.userId, tokenHash: record!.tokenHash });
    const users = getUsers();
    expect(Boolean(users.get('user-verify-mem')?.emailVerifiedAt)).toBe(true);
    flags.missing = false;
  });
});
