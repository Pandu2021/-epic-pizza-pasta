import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { prisma } from '../prisma';

const STATUSES_TO_PURGE = ['delivered', 'completed', 'cancelled'];

@Injectable()
export class GuestOrdersRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('GuestOrdersRetention');
  private readonly retentionMs: number;
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    const minutes = Number(process.env.GUEST_DATA_RETENTION_MINUTES || 240); // default 4 hours
    const interval = Number(process.env.GUEST_PURGE_SCAN_MINUTES || 15);
    this.retentionMs = Math.max(minutes, 5) * 60 * 1000;
    this.intervalMs = Math.max(interval, 1) * 60 * 1000;
  }

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.purge().catch((err) => {
        this.logger.error(`Guest data purge failed: ${err?.message || err}`);
      });
    }, this.intervalMs);
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
    // Kick off an initial purge shortly after boot
    const kick = setTimeout(() => {
      void this.purge().catch((err) => this.logger.error(`Initial guest purge failed: ${err?.message || err}`));
    }, 10_000);
    if (typeof kick.unref === 'function') {
      kick.unref();
    }
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async purge() {
    if (!this.retentionMs) return;
    const cutoff = new Date(Date.now() - this.retentionMs);
    const candidates = await prisma.order.findMany({
      where: {
        userId: null,
        status: { in: STATUSES_TO_PURGE },
        updatedAt: { lt: cutoff },
        NOT: {
          address: 'PURGED',
        },
      },
      select: {
        id: true,
      },
      take: 200,
    });
    if (!candidates.length) {
      return;
    }

    const ids = candidates.map((c) => c.id);
    this.logger.log(`Purging guest data for ${ids.length} orders`);
    await prisma.order.updateMany({
      where: { id: { in: ids } },
      data: {
        customerName: 'Guest',
        customerEmail: null,
        phone: '0000000000',
        address: 'PURGED',
        lat: null,
        lng: null,
        lineUserId: null,
      } as any,
    });
    await prisma.payment.updateMany({
      where: { orderId: { in: ids } },
      data: {
        providerRefId: null,
      } as any,
    });
  }
}
