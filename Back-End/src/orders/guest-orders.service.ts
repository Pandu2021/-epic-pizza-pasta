import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import type { VerificationResult } from './guest-verification.service';

type GuestOrderSession = {
  token: string;
  orderId: string;
  createdAt: number;
  expiresAt: number;
  lastKnownStatus?: string;
  email?: string | null;
  phone?: string | null;
  lineUserId?: string | null;
  verifiedChannel?: VerificationResult['channel'];
  verifiedAt?: number;
};

type GuestOrderSummary = {
  orderId: string;
  status: string | null;
  amountTotal: number;
  total: number;
  createdAt: string | null;
  subtotal: number;
  deliveryFee: number;
  tax: number;
  discount: number;
  expectedReadyAt?: string | null;
  expectedDeliveryAt?: string | null;
  payment?: {
    type: string | null;
    qrPayload?: string | null;
    status?: string | null;
  } | null;
  items: Array<{
    id: string;
    name: string;
    nameSnapshot?: string;
    qty: number;
    price: number;
    priceSnapshot?: number;
  }>;
  customer: {
    deliveryType: string | null;
    phoneMasked: string | null;
    nameMasked: string | null;
    emailMasked: string | null;
    lineMasked: string | null;
  };
  expiresAt: string;
  verification?: {
    channel: VerificationResult['channel'];
    verifiedAt: string;
  } | null;
};

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

@Injectable()
export class GuestOrdersService implements OnModuleDestroy {
  private readonly sessions = new Map<string, GuestOrderSession>();
  private readonly ttlMs: number;
  private readonly cleanupHandle: NodeJS.Timeout;

  constructor(private readonly orders: OrdersService) {
    const ttlMinutes = Number(process.env.GUEST_ORDER_TTL_MINUTES || NaN);
    const ttlMsEnv = Number(process.env.GUEST_ORDER_TTL_MS || NaN);
    let ttl = DEFAULT_TTL_MS;
    if (Number.isFinite(ttlMsEnv) && ttlMsEnv > 0) ttl = ttlMsEnv;
    else if (Number.isFinite(ttlMinutes) && ttlMinutes > 0) ttl = Math.round(ttlMinutes * 60 * 1000);
    this.ttlMs = ttl;
    this.cleanupHandle = setInterval(() => this.cleanupExpiredSessions(), 60_000);
    if (typeof this.cleanupHandle.unref === 'function') this.cleanupHandle.unref();
  }

  async createGuestOrder(dto: CreateOrderDto, options?: { verification?: VerificationResult | null }) {
    const order = await this.orders.create(dto);
    if (!order?.id) {
      throw new NotFoundException('Failed to create order');
    }
    const token = randomUUID();
    const now = Date.now();
    const expiresAt = now + this.ttlMs;
    this.sessions.set(token, {
      token,
      orderId: order.id,
      createdAt: now,
      expiresAt,
      lastKnownStatus: order.status ?? undefined,
      email: dto.customer.email || null,
      phone: dto.customer.phone || null,
      lineUserId: dto.customer.lineId || null,
      verifiedChannel: options?.verification?.channel,
      verifiedAt: options?.verification ? options.verification.verifiedAt.getTime() : undefined,
    });
    return {
      guestToken: token,
      expiresAt: new Date(expiresAt).toISOString(),
      summary: this.toSummary(order, this.sessions.get(token)!),
    } as const;
  }

  async getGuestOrder(token: string): Promise<GuestOrderSummary> {
    this.cleanupExpiredSessions();
    const session = this.sessions.get(token);
    if (!session) {
      throw new NotFoundException('Guest order session expired or not found');
    }
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      throw new NotFoundException('Guest order session expired');
    }
    const order = await this.orders.get(session.orderId);
    if (!order) {
      this.sessions.delete(token);
      throw new NotFoundException('Order no longer available');
    }
    session.lastKnownStatus = order.status ?? session.lastKnownStatus;
    return this.toSummary(order, session);
  }

  markStatus(token: string, status: string | null | undefined) {
    if (!status) return;
    const s = this.sessions.get(token);
    if (s) {
      s.lastKnownStatus = status;
    }
  }

  cleanupExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(token);
      }
    }
  }

  onModuleDestroy() {
    clearInterval(this.cleanupHandle);
  }

  private toSummary(order: any, session: GuestOrderSession): GuestOrderSummary {
    const payment = order?.payment
      ? {
          type: order.payment?.method ?? null,
          qrPayload: order.payment?.promptpayQR ?? null,
          status: order.payment?.status ?? null,
        }
      : null;
    const expectedReadyAt = order?.expectedReadyAt ? new Date(order.expectedReadyAt).toISOString() : null;
    const expectedDeliveryAt = order?.expectedDeliveryAt ? new Date(order.expectedDeliveryAt).toISOString() : null;
    const phoneRaw = order?.phone ?? session.phone ?? null;
    const emailRaw = order?.customerEmail ?? session.email ?? null;
    const lineRaw = order?.lineUserId ?? session.lineUserId ?? null;
    const verification = session.verifiedChannel && session.verifiedAt
      ? {
          channel: session.verifiedChannel,
          verifiedAt: new Date(session.verifiedAt).toISOString(),
        }
      : null;
    return {
      orderId: order?.id ?? session.orderId,
      status: order?.status ?? session.lastKnownStatus ?? null,
  amountTotal: order?.total ?? 0,
  total: order?.total ?? 0,
      createdAt: order?.createdAt ? new Date(order.createdAt).toISOString() : null,
      subtotal: order?.subtotal ?? 0,
      deliveryFee: order?.deliveryFee ?? 0,
      tax: order?.tax ?? 0,
      discount: order?.discount ?? 0,
      expectedReadyAt,
      expectedDeliveryAt,
      payment,
      items: Array.isArray(order?.items)
        ? order.items.map((it: any, idx: number) => ({
            id: String(it?.id || it?.menuItemId || `${session.orderId}-${idx}`),
            name: String(it?.nameSnapshot || it?.name || ''),
            nameSnapshot: String(it?.nameSnapshot || it?.name || ''),
            qty: Number(it?.qty ?? 0),
            price: Number(it?.priceSnapshot ?? it?.price ?? 0),
            priceSnapshot: Number(it?.priceSnapshot ?? it?.price ?? 0),
          }))
        : [],
      customer: {
        deliveryType: order?.deliveryType ?? null,
        phoneMasked: this.maskPhone(phoneRaw),
        nameMasked: this.maskName(order?.customerName ?? null),
        emailMasked: this.maskEmail(emailRaw),
        lineMasked: this.maskLine(lineRaw),
      },
      expiresAt: new Date(session.expiresAt).toISOString(),
      verification,
    };
  }

  private maskPhone(phone: string | null): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 4) return '*'.repeat(Math.max(0, digits.length - 1)) + digits.slice(-1);
    const tail = digits.slice(-4);
    return `${'*'.repeat(Math.max(0, digits.length - 4))}${tail}`;
  }

  private maskName(name: string | null): string | null {
    if (!name) return null;
    const trimmed = String(name).trim();
    if (!trimmed) return null;
    if (trimmed.length <= 2) return `${trimmed[0]}*`;
    return `${trimmed[0]}${'*'.repeat(trimmed.length - 2)}${trimmed[trimmed.length - 1]}`;
  }

  private maskEmail(email: string | null): string | null {
    if (!email) return null;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) return null;
    const [local, domain] = trimmed.split('@');
    if (!local) return `*@${domain || '***'}`;
    if (local.length <= 2) {
      return `${local[0] ?? '*'}*@${domain}`;
    }
    return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
  }

  private maskLine(lineId: string | null): string | null {
    if (!lineId) return null;
    const trimmed = lineId.trim();
    if (!trimmed) return null;
    if (trimmed.length <= 3) return `${trimmed[0] ?? '*'}**`;
    return `${trimmed.slice(0, 2)}***${trimmed.slice(-1)}`;
  }
}
