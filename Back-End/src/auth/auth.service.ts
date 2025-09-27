import * as jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import * as crypto from 'crypto';

export type JwtUser = { id: string; email: string; role: string };
// Optional field refreshTokenHash may not exist yet if migration not applied.
type UserWithRefresh = { id: string; email: string; role: string; passwordHash: string; name: string | null; phone: string | null; createdAt: Date; updatedAt: Date; refreshTokenHash?: string | null };

// Fallback in-memory store (last resort if column absent / during dev pre-migration)
const memoryRefreshStore = new Map<string, string>();

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
};
