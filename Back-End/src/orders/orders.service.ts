import { Injectable, Inject } from '@nestjs/common';
// Prisma namespace types avoided here to simplify build in test env
import { CreateOrderDto } from './dto/create-order.dto';
import { buildPromptPayPayload } from '../utils/promptpay';
import { prisma } from '../prisma';
import { appendOrderToSheet, updateOrderStatusInSheet, appendOrderItemsToPrintSheet, updatePrintSheetStatus } from '../utils/sheets';
import { enqueue } from '../utils/job-queue';
import { computePricing, formatEta } from '../utils/pricing';
import { sendOrderEmail } from '../utils/email';
import { OrdersEvents } from './orders.events';
import { OrdersPrintService } from './orders.print';
import { normalizeThaiPhone } from '../utils/phone';

@Injectable()
export class OrdersService {
  constructor(
    private readonly events: OrdersEvents,
    @Inject(OrdersPrintService) private readonly printer: OrdersPrintService,
  ) {}
  // In-memory guard to avoid duplicate Google Sheets appends per order id (process lifetime)
  private appendedOrderIds = new Set<string>();
  async listByPhone(phone: string) {
    const normalized = normalizeThaiPhone(phone);
    return prisma.order.findMany({ where: { phone: normalized }, include: { items: true, payment: true }, orderBy: { createdAt: 'desc' } });
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
    const pricing = computePricing({
      items: dto.items.map(i => ({ price: i.price, qty: i.qty })),
      distanceKm: dto.delivery?.distanceKm,
      deliveryType: dto.delivery?.type || 'delivery',
      providedDeliveryFee: dto.delivery?.fee,
    });
    const { subtotal, deliveryFee, tax, discount, total, expectedReadyAt, expectedDeliveryAt } = pricing;

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
      let resolvedUserId: string | undefined = userId ?? undefined;
      if (!resolvedUserId && dto.customer.phone) {
        const normalizedPhone = normalizeThaiPhone(dto.customer.phone);
        const u = await prisma.user.findFirst({ where: { phone: normalizedPhone } });
        // coalesce potential null to undefined to satisfy Prisma's UserWhereUniqueInput
        resolvedUserId = (u?.id ?? undefined) as string | undefined;
      }

      created = await prisma.order.create({
        data: {
          customerName: dto.customer.name,
          phone: normalizeThaiPhone(dto.customer.phone),
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
          // Cast new fields until prisma migrate updates generated types
          expectedReadyAt: expectedReadyAt as any,
          expectedDeliveryAt: expectedDeliveryAt as any,
          ...(resolvedUserId ? { User: { connect: { id: resolvedUserId } } } : {}),
        } as any,
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
                // Simplified typing for JSON options to avoid dependency on Prisma namespace types
                options: (it as any).options as any,
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

    const order = await this.get(created.id);

    // Enqueue Google Sheets append ONCE (idempotent via Set) right after create
    if (order && process.env.GOOGLE_SHEET_ID && !this.appendedOrderIds.has(order.id)) {
      this.appendedOrderIds.add(order.id);
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
  items: order.items?.map((it: any) => ({ nameSnapshot: it.nameSnapshot, qty: it.qty, priceSnapshot: it.priceSnapshot })),
        payment: { status: order.payment?.status },
      } as const;
      enqueue({
        id: `sheets:${order.id}`,
        run: async () => {
          const ok = await appendOrderToSheet(payload);
          // Best-effort append to print sheet (kitchen ticket rows) if enabled
          try { await appendOrderItemsToPrintSheet(payload); } catch (e) { /* non-fatal */ }
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
    try { this.events?.emit(created.id, 'order.created', { id: created.id, status: order?.status }); } catch {}
    // Fire-and-forget email notification if user email can be resolved
    if (order?.userId) {
      enqueue({
        id: `email:order-created:${order.id}`,
        run: async () => {
          const userIdLookup = order.userId ?? undefined;
          const user = userIdLookup ? await prisma.user.findUnique({ where: { id: userIdLookup } }) : null;
          if (user?.email) {
            await sendOrderEmail({ id: order.id, to: user.email, customerName: order.customerName, total: order.total, status: order.status });
          }
        },
        maxRetries: 3,
        baseDelayMs: 1000,
      });
    }
    return order;
  }

  async get(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: { items: true, payment: true },
    });
  }

  async cancel(id: string) {
    const order = await prisma.order.update({ where: { id }, data: { status: 'cancelled' } });
    // Attempt refund if payment exists and is pending/unpaid
    try {
      const payment = await prisma.payment.findUnique({ where: { orderId: id } });
      if (payment && ['pending','unpaid'].includes(payment.status)) {
        await prisma.payment.update({ where: { orderId: id }, data: { status: 'refunded', paidAt: null as any } });
        await prisma.webhookEvent.create({ data: { type: 'payment.refund.simulated', payload: { orderId: id } as any } });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[orders.cancel] refund attempt failed (non-fatal)', e);
    }
    if (order && process.env.GOOGLE_SHEET_ID) {
      enqueue({
        id: `sheets:update-status:${order.id}`,
        run: async () => {
          const ok = await updateOrderStatusInSheet(order.id, 'cancelled');
          try { await updatePrintSheetStatus(order.id, 'cancelled'); } catch {}
          await prisma.webhookEvent.create({
            data: {
              type: ok ? 'sheets.status.success' : 'sheets.status.failure',
              payload: { id: order.id, status: 'cancelled' } as any,
            },
          });
          if (!ok) throw new Error('updateOrderStatusInSheet failed');
        },
        maxRetries: 5,
        baseDelayMs: 1500,
      });
    }
    return order;
  }
  
  async confirmDelivered(id: string) {
    const order = await prisma.order.update({ where: { id }, data: { status: 'delivered', deliveredAt: new Date() } as any });
    try { this.events?.emit(order.id, 'order.status', { status: order.status }); } catch {}
    return order;
  }

  async updateStatus(id: string, status: string, driverName?: string) {
    const allowed = ['received','preparing','out-for-delivery','completed','delivered','cancelled'];
    if (!allowed.includes(status)) throw new Error('Invalid status');
    const data: any = { status };
    if (driverName) data.driverName = driverName;
    if (status === 'delivered') data.deliveredAt = new Date();
  const order = await prisma.order.update({ where: { id }, data });
  try { this.events?.emit(order.id, 'order.status', { status: order.status, driverName: (order as any).driverName }); } catch {}
    // Auto-print when an order is confirmed/received
    if (status === 'received') {
      try { this.printer?.enqueuePrint(order.id); } catch {}
    }
    if (process.env.GOOGLE_SHEET_ID) {
      enqueue({
        id: `sheets:update-status:${order.id}:${status}`,
        run: async () => {
          const ok = await updateOrderStatusInSheet(order.id, status);
          try { await updatePrintSheetStatus(order.id, status); } catch {}
          await prisma.webhookEvent.create({
            data: {
              type: ok ? 'sheets.status.success' : 'sheets.status.failure',
              payload: { id: order.id, status } as any,
            },
          });
          if (!ok) throw new Error('updateOrderStatusInSheet failed');
        },
        maxRetries: 5,
        baseDelayMs: 1500,
      });
    }
    return order;
  }

  async eta(id: string) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return null;
    const anyOrder = order as any;
    const eta = formatEta({
      subtotal: anyOrder.subtotal,
      deliveryFee: anyOrder.deliveryFee,
      discount: anyOrder.discount,
      tax: anyOrder.tax,
      total: anyOrder.total,
      vatRate: Number(process.env.THAI_VAT_RATE || 0.07),
      expectedReadyAt: anyOrder.expectedReadyAt || new Date(),
      expectedDeliveryAt: anyOrder.expectedDeliveryAt || undefined,
    } as any);
    return { id: order.id, status: order.status, ...eta };
  }

  async requestPrint(orderId: string, requesterUserId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, userId: true, phone: true } });
    if (!order) {
      const err: any = new Error('Order not found'); err.status = 404; throw err;
    }
    // Allow if owned by user or phone matches user's phone (legacy orders)
    if (order.userId !== requesterUserId) {
      const user = await prisma.user.findUnique({ where: { id: requesterUserId }, select: { phone: true } });
      const userPhone = user?.phone ? normalizeThaiPhone(user.phone) : undefined;
      const orderPhone = order.phone ? normalizeThaiPhone(order.phone) : undefined;
      if (!userPhone || !orderPhone || userPhone !== orderPhone) {
        const err: any = new Error('Not permitted to print this order'); err.status = 403; throw err;
      }
    }
    // Enqueue print job
    this.printer?.enqueuePrint(orderId);
    try { this.events?.emit(orderId, 'order.print', { ok: true }); } catch {}
    return { ok: true };
  }

  async generateReceiptForDownload(orderId: string, requesterUserId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, userId: true, createdAt: true, phone: true } });
    if (!order) { const err: any = new Error('Order not found'); err.status = 404; throw err; }
    if (order.userId !== requesterUserId) {
      const user = await prisma.user.findUnique({ where: { id: requesterUserId }, select: { phone: true } });
      const userPhone = user?.phone ? normalizeThaiPhone(user.phone) : undefined;
      const orderPhone = (order as any).phone ? normalizeThaiPhone((order as any).phone) : undefined;
      if (!userPhone || !orderPhone || userPhone !== orderPhone) {
        const err: any = new Error('Not permitted to access this receipt'); err.status = 403; throw err;
      }
    }
    const filePath = await this.printer!.generateReceipt(orderId);
    const ts = order.createdAt ? new Date(order.createdAt).toISOString().slice(0,19).replace(/[:T]/g,'-') : 'receipt';
    const filename = `receipt-${order.id.slice(0,8)}-${ts}.pdf`;
    return { filePath, filename };
  }
}
