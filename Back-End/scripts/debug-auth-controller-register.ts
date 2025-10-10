import 'dotenv/config';
import { AuthController } from '../src/auth/auth.controller';
import { prisma } from '../src/prisma';

async function main() {
  const controller = new AuthController();
  const email = `controller-${Date.now()}@example.com`;
  const body = { email, password: 'Password123', name: 'Ctrl Debug' };

  const res = {
    cookies: new Map<string, any>(),
    cookie(name: string, value: string, options: any) {
      this.cookies.set(name, { value, options });
    },
  } as any;

  console.log('[controller-debug] invoking register for', email);
  const result = await controller.register(body, res);
  console.log('[controller-debug] register result', result);
  console.log('[controller-debug] cookies set', res.cookies);
}

main()
  .catch((err) => {
    console.error('[controller-debug] error', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
