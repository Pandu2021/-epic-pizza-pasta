import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export type JwtUser = { id: string; email: string; role: string };
// Optional field refreshTokenHash may not exist yet if migration not applied.
type UserWithRefresh = { id: string; email: string; role: string; passwordHash: string; name: string | null; phone: string | null; createdAt: Date; updatedAt: Date; refreshTokenHash?: string | null };

// Fallback in-memory store (last resort if column absent / during dev pre-migration)
const memoryRefreshStore = new Map<string, string>();

type PasswordResetMemoryRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  usedAt: Date | null;
};

const memoryPasswordResetStore = new Map<string, PasswordResetMemoryRecord>();
type PasswordResetTokenWithUser = Prisma.PasswordResetTokenGetPayload<{ include: { user: true } }>;

type EmailVerificationMemoryRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  consumedAt: Date | null;
};

const memoryEmailVerificationStore = new Map<string, EmailVerificationMemoryRecord>();
type EmailVerificationTokenWithUser = Prisma.EmailVerificationTokenGetPayload<{ include: { user: true } }>;

function isPasswordResetTableMissing(err: any): boolean {
  if (!err) return false;
  if (err.code === 'P2021') return true;
  const message: string | undefined = typeof err.message === 'string' ? err.message : undefined;
  if (!message) return false;
  return message.includes('PasswordResetToken');
}

function pruneMemoryTokensForUser(userId: string) {
  for (const [tokenHash, record] of memoryPasswordResetStore) {
    if (record.userId === userId) {
      memoryPasswordResetStore.delete(tokenHash);
    }
  }
}

async function hydrateUserForMemoryRecord(record: PasswordResetMemoryRecord): Promise<PasswordResetTokenWithUser | null> {
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) return null;
  return {
    ...record,
    user,
  } as unknown as PasswordResetTokenWithUser;
}

function isEmailVerificationTableMissing(err: any): boolean {
  if (!err) return false;
  if (err.code === 'P2021') return true;
  const message: string | undefined = typeof err.message === 'string' ? err.message : undefined;
  if (!message) return false;
  return message.includes('EmailVerificationToken');
}

function pruneEmailVerificationMemory(userId: string) {
  for (const [tokenHash, record] of memoryEmailVerificationStore) {
    if (record.userId === userId) {
      memoryEmailVerificationStore.delete(tokenHash);
    }
  }
}

async function hydrateEmailVerificationRecord(record: EmailVerificationMemoryRecord): Promise<EmailVerificationTokenWithUser | null> {
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) return null;
  return {
    ...record,
    user,
  } as unknown as EmailVerificationTokenWithUser;
}

export const auth = {
  signAccess(payload: JwtUser) {
    const key = (process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n') || '') as string;
  const opts: jwt.SignOptions = { algorithm: 'RS256', expiresIn: (process.env.JWT_ACCESS_TTL || '900s') as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload as any, key as any, opts as any) as string;
  },
  signRefresh(payload: JwtUser) {
    const key = (process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n') || '') as string;
  const opts: jwt.SignOptions = { algorithm: 'RS256', expiresIn: (process.env.JWT_REFRESH_TTL || '7d') as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload as any, key as any, opts as any) as string;
  },
  hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  },
  verify(token: string): JwtUser | null {
    try {
      const pub = (process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n') || '') as string;
      return jwt.verify(token, pub as jwt.Secret, { algorithms: ['RS256'] }) as JwtUser;
    } catch {
      return null;
    }
  },
  async getUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  async getUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },
  async storeRefreshToken(userId: string, token: string) {
    const hash = this.hashToken(token);
    try {
      // Attempt DB persistence; if schema not updated this will throw
      await (prisma as any).user.update({ where: { id: userId }, data: { refreshTokenHash: hash } });
    } catch (e: any) {
      // Fallback to memory (non-persistent) so dev flow keeps working
      memoryRefreshStore.set(userId, hash);
    }
  },
  async verifyAndRotateRefreshToken(token: string) {
    const payload = this.verify(token);
    if (!payload) return null;
    let user: UserWithRefresh | null = null;
    let refreshHash: string | null | undefined;
    try {
      user = await prisma.user.findUnique({ where: { id: payload.id }, select: { id: true, email: true, role: true, passwordHash: true, name: true, phone: true, createdAt: true, updatedAt: true, refreshTokenHash: true } as any }) as UserWithRefresh | null;
      refreshHash = user?.refreshTokenHash;
    } catch {
      // Likely column not present yet
      user = await prisma.user.findUnique({ where: { id: payload.id } }) as any;
      refreshHash = memoryRefreshStore.get(payload.id);
    }
    if (!user) return null;
    if (!refreshHash) return null; // must have previous stored
    const incomingHash = this.hashToken(token);
    if (incomingHash !== refreshHash) return null; // token reuse / invalid
    // rotate
    const newRefresh = this.signRefresh({ id: user.id, email: user.email, role: user.role });
    await this.storeRefreshToken(user.id, newRefresh);
    const newAccess = this.signAccess({ id: user.id, email: user.email, role: user.role });
    return { access: newAccess, refresh: newRefresh, user };
  },
  async generatePasswordResetToken(userId: string) {
    let useMemory = false;
    try {
      await prisma.passwordResetToken.deleteMany({ where: { userId } });
    } catch (err) {
      if (isPasswordResetTableMissing(err)) useMemory = true;
      else throw err;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const ttl = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MS || 1000 * 60 * 30); // default 30 minutes
    const expiresAt = new Date(Date.now() + ttl);
    const id = crypto.randomUUID();

    if (!useMemory) {
      try {
        await prisma.passwordResetToken.create({ data: { id, userId, tokenHash, expiresAt } });
      } catch (err) {
        if (isPasswordResetTableMissing(err)) useMemory = true;
        else throw err;
      }
    }

    if (useMemory) {
      pruneMemoryTokensForUser(userId);
      memoryPasswordResetStore.set(tokenHash, {
        id,
        userId,
        tokenHash,
        expiresAt,
        createdAt: new Date(),
        usedAt: null,
      });
    }

    return { token: rawToken, expiresAt };
  },
  async findValidPasswordResetToken(rawToken: string): Promise<PasswordResetTokenWithUser | null> {
    const tokenHash = this.hashToken(rawToken);
    try {
      const token = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: true } });
      if (!token) return null;
      if (token.usedAt) return null;
      if (token.expiresAt.getTime() < Date.now()) return null;
      return token;
    } catch (err) {
      if (!isPasswordResetTableMissing(err)) throw err;
      const record = memoryPasswordResetStore.get(tokenHash);
      if (!record) return null;
      if (record.usedAt) return null;
      if (record.expiresAt.getTime() < Date.now()) {
        memoryPasswordResetStore.delete(tokenHash);
        return null;
      }
      const hydrated = await hydrateUserForMemoryRecord(record);
      return hydrated;
    }
  },
  async consumePasswordResetToken(record: Pick<PasswordResetTokenWithUser, 'id' | 'userId' | 'tokenHash'>, passwordHash: string) {
    await prisma.user.update({ where: { id: record.userId }, data: { passwordHash, refreshTokenHash: null } });

    let memoryFallback = false;
    try {
      await prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    } catch (err) {
      if (isPasswordResetTableMissing(err)) memoryFallback = true;
      else throw err;
    }

    if (!memoryFallback) {
      try {
        await prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, id: { not: record.id } } });
      } catch (err) {
        if (isPasswordResetTableMissing(err)) memoryFallback = true;
        else throw err;
      }
    }

    if (memoryFallback) {
      memoryPasswordResetStore.delete(record.tokenHash);
      pruneMemoryTokensForUser(record.userId);
    }
  },
  async generateEmailVerificationToken(userId: string) {
    let useMemory = false;
    try {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    } catch (err) {
      if (isEmailVerificationTableMissing(err)) useMemory = true;
      else throw err;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const ttl = Number(process.env.EMAIL_VERIFICATION_TOKEN_TTL_MS || 1000 * 60 * 60 * 24); // default 24 hours
    const expiresAt = new Date(Date.now() + ttl);
    const id = crypto.randomUUID();

    if (!useMemory) {
      try {
        await prisma.emailVerificationToken.create({ data: { id, userId, tokenHash, expiresAt } });
      } catch (err) {
        if (isEmailVerificationTableMissing(err)) useMemory = true;
        else throw err;
      }
    }

    if (useMemory) {
      pruneEmailVerificationMemory(userId);
      memoryEmailVerificationStore.set(tokenHash, {
        id,
        userId,
        tokenHash,
        expiresAt,
        createdAt: new Date(),
        consumedAt: null,
      });
    }

    return { token: rawToken, expiresAt };
  },
  async findValidEmailVerificationToken(rawToken: string): Promise<EmailVerificationTokenWithUser | null> {
    const tokenHash = this.hashToken(rawToken);
    try {
      const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash }, include: { user: true } });
      if (!record) return null;
      if (record.consumedAt) return null;
      if (record.expiresAt.getTime() < Date.now()) return null;
      return record;
    } catch (err) {
      if (!isEmailVerificationTableMissing(err)) throw err;
      const memoryRecord = memoryEmailVerificationStore.get(tokenHash);
      if (!memoryRecord) return null;
      if (memoryRecord.consumedAt) return null;
      if (memoryRecord.expiresAt.getTime() < Date.now()) {
        memoryEmailVerificationStore.delete(tokenHash);
        return null;
      }
      return hydrateEmailVerificationRecord(memoryRecord);
    }
  },
  async consumeEmailVerificationToken(record: Pick<EmailVerificationTokenWithUser, 'id' | 'userId' | 'tokenHash'>) {
    const verifiedAt = new Date();
    await prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: verifiedAt } });

    let memoryFallback = false;
    try {
      await prisma.emailVerificationToken.update({ where: { id: record.id }, data: { consumedAt: verifiedAt } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId, id: { not: record.id } } });
    } catch (err) {
      if (isEmailVerificationTableMissing(err)) memoryFallback = true;
      else throw err;
    }

    if (memoryFallback) {
      const existing = memoryEmailVerificationStore.get(record.tokenHash);
      if (existing) {
        existing.consumedAt = verifiedAt;
        memoryEmailVerificationStore.set(record.tokenHash, existing);
      }
      pruneEmailVerificationMemory(record.userId);
    }

    return verifiedAt;
  },
};
