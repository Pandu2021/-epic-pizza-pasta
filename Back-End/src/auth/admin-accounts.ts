import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export const BUILT_IN_ADMIN_EMAILS = [
  'panduwicaksono2021@gmail.com',
  'epicpizzaorders@gmail.com',
  'epicpizzaandpasta@gmail.com',
].map((email) => email.toLowerCase());

const ADMIN_PASSWORD_FALLBACK = 'Me4medigap!';

export function isBuiltInAdminEmail(email: string): boolean {
  return BUILT_IN_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

let cachedPassword: { raw: string; hash: string } | null = null;

async function resolveAdminPasswordHash(): Promise<{ password: string; hash: string }> {
  const password = process.env.BUILT_IN_ADMIN_PASSWORD?.trim() || ADMIN_PASSWORD_FALLBACK;
  if (cachedPassword && cachedPassword.raw === password) {
    return { password, hash: cachedPassword.hash };
  }
  const hash = await argon2.hash(password);
  cachedPassword = { raw: password, hash };
  return { password, hash };
}

export async function ensureBuiltInAdminAccount(email: string): Promise<void> {
  if (!isBuiltInAdminEmail(email)) return;

  const lower = email.trim().toLowerCase();
  const { hash } = await resolveAdminPasswordHash();
  const now = new Date();

  const existing = await prisma.user.findUnique({ where: { email: lower } }).catch(() => null);
  if (!existing) {
    await prisma.user.create({
      data: {
        email: lower,
        passwordHash: hash,
        role: 'admin',
        name: null,
        emailVerifiedAt: now,
      },
    });
    return;
  }

  const updates: Prisma.UserUpdateInput = {};
  if (existing.role !== 'admin') updates.role = 'admin';
  updates.passwordHash = hash;
  if (!(existing as any).emailVerifiedAt) {
    updates.emailVerifiedAt = now;
  }

  if (Object.keys(updates).length > 0) {
    await prisma.user.update({ where: { id: existing.id }, data: updates });
  }
}

export async function ensureBuiltInAdminAccounts(): Promise<void> {
  for (const email of BUILT_IN_ADMIN_EMAILS) {
    await ensureBuiltInAdminAccount(email);
  }
}
