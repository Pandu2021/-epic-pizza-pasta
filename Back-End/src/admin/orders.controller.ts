import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { prisma } from '../prisma';
import { enqueue } from '../utils/job-queue';
import { updateOrderStatusInSheet } from '../utils/sheets';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { AdminOrderStatusDto } from './dto/order.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('api/admin/orders')
export class AdminOrdersController {
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
    const updated = await prisma.order.update({ where: { id }, data: { status: body.status } });
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
}
