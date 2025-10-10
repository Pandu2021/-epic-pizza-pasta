import 'dotenv/config';
import * as argon2 from 'argon2';
import { prisma } from '../src/prisma';
import { auth } from '../src/auth/auth.service';
import { sendEmail } from '../src/utils/email';

async function main() {
  const email = `debug-${Date.now()}@example.com`;
  const password = 'Password123';
  const name = 'Debug User';
  const phone = null;
  const lineUserId = null;

  console.log('[debug] starting register flow for', email);
  const passwordHash = await argon2.hash(password);
  console.log('[debug] password hashed');

  let user;
  try {
    user = await prisma.user.create({ data: { email, passwordHash, name, phone, lineUserId } });
    console.log('[debug] user created', user.id);
  } catch (err) {
    console.error('[debug] prisma.user.create failed', err);
    throw err;
  }

  try {
    const { token, expiresAt } = await auth.generateEmailVerificationToken(user.id);
    console.log('[debug] generated token', token.slice(0, 8), 'expires', expiresAt.toISOString());
    try {
      await sendEmail({ to: user.email, subject: 'Verify email', text: `Token: ${token}` });
      console.log('[debug] sendEmail succeeded');
    } catch (err) {
      console.error('[debug] sendEmail failed', err);
    }
  } catch (err) {
    console.error('[debug] generateEmailVerificationToken failed', err);
  }

  const payload = { id: user.id, email: user.email, role: user.role };
  try {
    const access = auth.signAccess(payload);
    console.log('[debug] access token length', access.length);
  } catch (err) {
    console.error('[debug] signAccess failed', err);
    throw err;
  }

  let refresh: string;
  try {
    refresh = auth.signRefresh(payload);
    console.log('[debug] refresh token length', refresh.length);
  } catch (err) {
    console.error('[debug] signRefresh failed', err);
    throw err;
  }

  try {
    await auth.storeRefreshToken(user.id, refresh);
    console.log('[debug] stored refresh token');
  } catch (err) {
    console.error('[debug] storeRefreshToken failed', err);
  }

  console.log('[debug] register flow completed without throwing');
}

main()
  .catch((err) => {
    console.error('[debug] script failed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
