import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { buildPromptPayPayload } from '../utils/promptpay';
import { prisma } from '../prisma';

@Injectable()
export class OrdersService {
  async listByPhone(phone: string) {
    return prisma.order.findMany({ where: { phone }, include: { items: true, payment: true }, orderBy: { createdAt: 'desc' } });
  }
  async create(dto: CreateOrderDto) {
    const subtotal = dto.items.reduce((sum, it) => sum + it.price * it.qty, 0);
    const deliveryFee = dto.delivery.fee ?? 0;
    const tax = 0;
    const discount = 0;
    const total = subtotal + deliveryFee + tax - discount;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await prisma.$transaction(async (tx: any) => {
      const created = await tx.order.create({
        data: {
          customerName: dto.customer.name,
          phone: dto.customer.phone,
          address: dto.customer.address,
          lat: dto.customer.lat,
          lng: dto.customer.lng,
          subtotal,
          deliveryFee,
          tax,
          discount,
          total,
          paymentMethod: dto.paymentMethod,
          deliveryType: dto.delivery.type,
          distanceKm: dto.delivery.distanceKm,
          items: {
            create: dto.items.map((it) => ({
              menuItemId: it.id,
              nameSnapshot: it.name,
              priceSnapshot: it.price,
              qty: it.qty,
              options: it.options ?? null,
            })),
          },
        },
        include: { items: true },
      });

      let promptpayQR: string | undefined;
      if (dto.paymentMethod === 'promptpay') {
        promptpayQR = buildPromptPayPayload({
          merchantId: process.env.PROMPTPAY_MERCHANT_ID || '0000000000000',
          amount: total / 1.0,
        });
      }

      await tx.payment.create({
        data: {
          orderId: created.id,
          method: dto.paymentMethod,
          status: dto.paymentMethod === 'promptpay' ? 'pending' : 'unpaid',
          promptpayQR,
        },
      });

      return created;
    });

    return this.get(order.id);
  }

  async get(id: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true, payment: true },
    });
    return order;
  }

  async cancel(id: string) {
    const order = await prisma.order.update({ where: { id }, data: { status: 'cancelled' } });
    return order;
  }
}
