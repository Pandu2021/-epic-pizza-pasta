import 'dotenv/config';
import { prisma } from '../src/prisma';

async function main() {
  const users = await prisma.user.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, createdAt: true, role: true, emailVerifiedAt: true },
  });
  console.log('recent users:', users);
}

main()
  .catch((err) => {
    console.error('debug-list-users error', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
