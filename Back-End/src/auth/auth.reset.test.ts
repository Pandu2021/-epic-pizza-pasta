import { describe, it, expect, beforeEach, vi } from 'vitest';

const { tokenStoreKey, flagStoreKey, userStoreKey } = vi.hoisted(() => ({
  tokenStoreKey: '__passwordResetTokens__',
  flagStoreKey: '__passwordResetFlags__',
  userStoreKey: '__passwordResetUsers__',
}));

vi.mock('../prisma', () => {
  const tokenStore = ((globalThis as any)[tokenStoreKey] ||= []) as any[];
  const flags = ((globalThis as any)[flagStoreKey] ||= { missing: false }) as { missing: boolean };
  const userStore = ((globalThis as any)[userStoreKey] ||= new Map<string, any>());

  const ensureUser = (id: string) => {
    if (!userStore.has(id)) {
      userStore.set(id, {
        id,
        email: `${id}@example.com`,
        passwordHash: 'old-hash',
        role: 'customer',
        name: 'Test User',
        phone: null,
        refreshTokenHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return userStore.get(id);
  };

  const missing = () => {
    if (!flags.missing) return;
    const err: any = new Error('PasswordResetToken table missing');
    err.code = 'P2021';
    throw err;
  };

  const prismaMock = {
    passwordResetToken: {
      create: vi.fn(async ({ data }: any) => {
        missing();
        const record = {
          id: data.id,
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          usedAt: data.usedAt ?? null,
          createdAt: new Date(),
        };
        tokenStore.push(record);
        return record;
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
      deleteMany: vi.fn(async ({ where }: any) => {
        missing();
        const userId = where?.userId;
        const excludeId = where?.id?.not as string | undefined;
        const keep = tokenStore.filter((token) => {
          if (userId && token.userId !== userId) return true;
          if (userId && excludeId && token.id === excludeId) return true;
          return !(userId && token.userId === userId);
        });
        tokenStore.splice(0, tokenStore.length, ...keep);
        return { count: keep.length };
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
  (globalThis as any)[flagStoreKey] = flags;
  (globalThis as any)[userStoreKey] = userStore;
  return { prisma: prismaMock };
});

// Import after mocking prisma
import { auth } from './auth.service';

const getStore = () => ((globalThis as any)[tokenStoreKey] ||= []) as any[];
const getFlags = () => ((globalThis as any)[flagStoreKey] ||= { missing: false }) as { missing: boolean };
const getUsers = () => ((globalThis as any)[userStoreKey] ||= new Map<string, any>()) as Map<string, any>;

describe('password reset token helpers', () => {
  beforeEach(() => {
    const store = getStore();
    store.length = 0;
    const users = getUsers();
    users.clear();
    const flags = getFlags();
    flags.missing = false;
  });

  it('creates and stores a hashed password reset token', async () => {
    const result = await auth.generatePasswordResetToken('user-1');
    expect(result.token.length).toBeGreaterThanOrEqual(40);
    const saved = getStore();
    expect(saved).toHaveLength(1);
    expect(saved[0].userId).toBe('user-1');
    expect(saved[0].tokenHash).toBe(auth.hashToken(result.token));
  });

  it('replaces previous tokens for the same user', async () => {
    const first = await auth.generatePasswordResetToken('user-2');
    const second = await auth.generatePasswordResetToken('user-2');
    expect(first.token).not.toBe(second.token);
    const saved = getStore();
    expect(saved).toHaveLength(1);
    expect(saved[0].tokenHash).toBe(auth.hashToken(second.token));
  });

  it('finds valid tokens and rejects expired ones', async () => {
    const { token } = await auth.generatePasswordResetToken('user-3');
    const valid = await auth.findValidPasswordResetToken(token);
    expect(valid?.user.id).toBe('user-3');

    const saved = getStore()[0];
    saved.expiresAt = new Date(Date.now() - 1000);
    const expired = await auth.findValidPasswordResetToken(token);
    expect(expired).toBeNull();
  });

  it('falls back to in-memory storage when password reset table is missing', async () => {
    const flags = getFlags();
    flags.missing = true;
    const { token } = await auth.generatePasswordResetToken('user-mem');
    const record = await auth.findValidPasswordResetToken(token);
    expect(record?.user.id).toBe('user-mem');

    await auth.consumePasswordResetToken(
      { id: record!.id, userId: record!.userId, tokenHash: record!.tokenHash },
      'new-password-hash',
    );
    const users = getUsers();
    expect(users.get('user-mem')?.passwordHash).toBe('new-password-hash');
    flags.missing = false;
  });
});
