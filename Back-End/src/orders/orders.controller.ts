import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  async list(@Query('phone') phone?: string) {
    if (!phone) return { error: 'phone query is required to list orders' };
    return this.orders.listByPhone(phone);
  }

  @Post()
  async create(@Body() dto: CreateOrderDto) {
    const order = await this.orders.create(dto);
    return {
      orderId: order?.id,
      status: order?.status,
      amountTotal: order?.total,
      payment: order?.payment && {
        type: order.payment.method,
        qrPayload: order.payment.promptpayQR,
        status: order.payment.status,
      },
    };
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.orders.get(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.orders.cancel(id);
  }
}
