import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { prisma } from '../prisma';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';

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
  async setStatus(@Param('id') id: string, @Body() body: { status: string }) {
    const updated = await prisma.order.update({ where: { id }, data: { status: body.status } });
    return updated;
  }
}
