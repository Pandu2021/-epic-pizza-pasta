// Rebuild Google Sheets Orders worksheet from DB
// Usage: tsx scripts/rebuild-orders-sheet.ts
import { prisma } from '../src/prisma';
import { rebuildOrdersSheet } from '../src/utils/sheets';

async function main() {
  const orders = await prisma.order.findMany({ include: { items: true, payment: true }, orderBy: { createdAt: 'asc' } });
  const ok = await rebuildOrdersSheet(orders as any);
  console.log('[rebuild-orders-sheet] result:', ok);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
