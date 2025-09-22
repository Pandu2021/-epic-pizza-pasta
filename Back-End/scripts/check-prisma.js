const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  try {
    console.log('delegates keys:', Object.keys(p));
    console.log('has order:', !!p.order, 'type:', typeof p.order);
    console.log('has order.create:', p.order && typeof p.order.create);
    console.log('has orderItem:', !!p.orderItem, 'createMany:', p.orderItem && typeof p.orderItem.createMany);
    console.log('has payment:', !!p.payment, 'create:', p.payment && typeof p.payment.create);
  } finally {
    await p.$disconnect();
  }
})();