import * as jwt from 'jsonwebtoken';
import { prisma } from '../prisma';

export type JwtUser = { id: string; email: string; role: string };

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
};
