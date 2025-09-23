import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { buildPromptPayPayload } from '../utils/promptpay';
import { prisma } from '../prisma';
import { appendOrderToSheet } from '../utils/sheets';
import { enqueue } from '../utils/job-queue';

@Injectable()
export class OrdersService {
  async listByPhone(phone: string) {
    return prisma.order.findMany({ where: { phone }, include: { items: true, payment: true }, orderBy: { createdAt: 'desc' } });
  }
  async listForUser(userId: string) {
    // Primary: orders explicitly linked to userId
    // Secondary: include recent orders where phone matches the user's phone (in case legacy orders weren't linked)
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    const phone = user?.phone || undefined;
    const where = phone
      ? { OR: [ { userId }, { userId: null, phone } ] }
      : { userId };
    return prisma.order.findMany({ where, include: { items: true, payment: true }, orderBy: { createdAt: 'desc' } });
  }
  async create(dto: CreateOrderDto, userId?: string) {
    const subtotal = dto.items.reduce((sum, it) => sum + it.price * it.qty, 0);
    const deliveryFee = dto.delivery.fee ?? 0;
    const tax = 0;
    const discount = 0;
    const total = subtotal + deliveryFee + tax - discount;

    // Simple non-transactional flow (safe for our simple create semantics)
    // Debug: log minimal shape
    // eslint-disable-next-line no-console
    console.log('[orders.create] creating order with', {
      items: dto.items?.length,
      paymentMethod: dto.paymentMethod,
      deliveryType: dto.delivery?.type,
    });
    // Diagnostics: verify Prisma delegates are present
    // eslint-disable-next-line no-console
    console.log('[orders.create] delegates', {
      hasOrder: !!(prisma as any).order,
      hasOrderCreate: !!((prisma as any).order && (prisma as any).order.create),
      hasOrderItem: !!(prisma as any).orderItem,
      hasOrderItemCreateMany: !!((prisma as any).orderItem && (prisma as any).orderItem.createMany),
      hasPayment: !!(prisma as any).payment,
      hasPaymentCreate: !!((prisma as any).payment && (prisma as any).payment.create),
    });

    // eslint-disable-next-line no-console
    console.log('[orders.create] about to prisma.order.create');
    let created;
    try {
      // If userId not provided but phone matches a user, resolve it
      let resolvedUserId: string | undefined = userId;
      if (!resolvedUserId && dto.customer.phone) {
        const u = await prisma.user.findFirst({ where: { phone: dto.customer.phone } });
        resolvedUserId = u?.id;
      }

      created = await prisma.order.create({
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
          ...(resolvedUserId ? { User: { connect: { id: resolvedUserId } } } : {}),
        },
      });
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[orders.create] prisma.order.create failed:', msg, err);
      throw err;
    }
    // eslint-disable-next-line no-console
    console.log('[orders.create] order created id=', created.id);

    // Create order items in a separate step
    if (dto.items?.length) {
      // eslint-disable-next-line no-console
      console.log('[orders.create] creating order items via createMany');
      await prisma.orderItem.createMany({
        data: dto.items.map((it) => ({
          orderId: created.id,
          menuItemId: it.id,
          nameSnapshot: it.name,
          priceSnapshot: it.price,
          qty: it.qty,
          // createMany doesn't support Json fields in some drivers; fallback to null
          // If options needed, switch to per-item create
          options: undefined as any,
        })),
      }).catch(async (e: unknown) => {
        // eslint-disable-next-line no-console
        const emsg = e instanceof Error ? e.message : String(e);
        console.warn('[orders.create] createMany failed, falling back to per-item create', emsg);
        // Fallback to per-item create to support JSON options reliably
        for (const it of dto.items) {
          try {
            await prisma.orderItem.create({
              data: {
                orderId: created.id,
                menuItemId: it.id,
                nameSnapshot: it.name,
                priceSnapshot: it.price,
                qty: it.qty,
                options: (it.options === undefined ? undefined : (it.options === null ? Prisma.JsonNull : (it.options as Prisma.InputJsonValue))),
              },
            });
          } catch (ie: unknown) {
            // eslint-disable-next-line no-console
            const iemsg = ie instanceof Error ? ie.message : String(ie);
            console.error('[orders.create] orderItem.create failed for item', it?.id, iemsg);
            throw ie;
          }
        }
      });
    }

    let promptpayQR: string | undefined;
    if (dto.paymentMethod === 'promptpay') {
      promptpayQR = buildPromptPayPayload({
        merchantId: process.env.PROMPTPAY_MERCHANT_ID || '0000000000000',
        amount: total / 1.0,
      });
    }

    const hasPaymentCreate = !!(prisma as any).payment && typeof (prisma as any).payment.create === 'function';
    if (!hasPaymentCreate) {
      // eslint-disable-next-line no-console
      console.warn('[orders.create] prisma.payment.create missing; skipping payment row create');
    }
    if (hasPaymentCreate) {
      // eslint-disable-next-line no-console
      console.log('[orders.create] creating payment row');
      try {
        await prisma.payment.create({
          data: {
            orderId: created.id,
            method: dto.paymentMethod,
            status: dto.paymentMethod === 'promptpay' ? 'pending' : 'unpaid',
            promptpayQR,
          },
        });
      } catch (pe: unknown) {
        // eslint-disable-next-line no-console
        const pemsg = pe instanceof Error ? pe.message : String(pe);
        console.error('[orders.create] prisma.payment.create failed:', pemsg);
        throw pe;
      }
    }

    return this.get(created.id);
  }

  async get(id: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true, payment: true },
    });
    // Enqueue Google Sheets append (non-blocking) with retry & DB log
    if (order && process.env.GOOGLE_SHEET_ID) {
      const payload = {
        id: order.id,
        customerName: order.customerName,
        phone: order.phone,
        address: order.address,
        deliveryType: order.deliveryType,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        tax: order.tax,
        discount: order.discount,
        total: order.total,
        paymentMethod: order.paymentMethod,
        status: order.status,
        createdAt: order.createdAt,
        items: order.items?.map((it) => ({ nameSnapshot: it.nameSnapshot, qty: it.qty, priceSnapshot: it.priceSnapshot })),
        payment: { status: order.payment?.status },
      } as const;

      enqueue({
        id: `sheets:${order.id}`,
        run: async () => {
          const ok = await appendOrderToSheet(payload);
          await prisma.webhookEvent.create({
            data: {
              type: ok ? 'sheets.append.success' : 'sheets.append.failure',
              payload: payload as any,
            },
          });
          if (!ok) throw new Error('appendOrderToSheet returned false');
        },
        maxRetries: 5,
        baseDelayMs: 1500,
      });
    }
    return order;
  }

  async cancel(id: string) {
    const order = await prisma.order.update({ where: { id }, data: { status: 'cancelled' } });
    return order;
  }
}
