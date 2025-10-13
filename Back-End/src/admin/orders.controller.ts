import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { prisma } from '../prisma';
import { enqueue } from '../utils/job-queue';
import { updateOrderStatusInSheet } from '../utils/sheets';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { AdminOrderStatusDto } from './dto/order.dto';
import { OrdersService } from '../orders/orders.service';
import { Request } from 'express';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('api/admin/orders')
export class AdminOrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @Get()
  list() {
    return prisma.order.findMany({ include: { items: true, payment: true }, orderBy: { createdAt: 'desc' } });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return prisma.order.findUnique({ where: { id }, include: { items: true, payment: true } });
  }

  @Patch(':id/status')
  async setStatus(@Param('id') id: string, @Body() body: AdminOrderStatusDto) {
    const data: any = { status: body.status };
    if ((body as any).driverName) data.driverName = (body as any).driverName;
    if (body.status === 'delivered') data.deliveredAt = new Date();
    const updated = await prisma.order.update({ where: { id }, data });
    if (process.env.GOOGLE_SHEET_ID) {
      enqueue({
        id: `sheets:admin-status:${id}`,
        run: async () => {
          const ok = await updateOrderStatusInSheet(id, body.status);
          await prisma.webhookEvent.create({
            data: { type: ok ? 'sheets.status.success' : 'sheets.status.failure', payload: { id, status: body.status } as any },
          });
          if (!ok) throw new Error('updateOrderStatusInSheet failed');
        },
        maxRetries: 5,
        baseDelayMs: 1500,
      });
    }
    return updated;
  }

  @Post(':id/receipt')
  async reprint(@Param('id') id: string, @Req() req: Request) {
    const userId = ((req as any).user?.id as string | undefined) ?? 'admin-console';
    try {
      await this.orders.requestPrint(id, userId, true);
      return { ok: true };
    } catch (err: any) {
      const status = err?.status || HttpStatus.BAD_REQUEST;
      const message = err?.message || 'Failed to queue print job';
      throw new HttpException(message, status);
    }
  }

  @Get('metrics/summary')
  async metrics() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [ordersToday, revenueAgg, pendingPayments] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.order.aggregate({ _sum: { total: true }, where: { createdAt: { gte: startOfDay } } }),
      prisma.payment.count({ where: { status: { in: ['pending','unpaid'] } } }),
    ]);
    return {
      ts: now.toISOString(),
      ordersToday,
      revenueToday: revenueAgg._sum.total || 0,
      unpaidOrPendingPayments: pendingPayments,
    };
  }
}
