import { Body, Controller, Get, HttpException, HttpStatus, Inject, Param, Post, Query, UseGuards, Req } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { Request } from 'express';
import { auth } from '../auth/auth.service';

@Controller('api/orders')
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {
    // eslint-disable-next-line no-console
    console.log('[orders.controller] constructed; orders injected =', !!this.orders);
  }

  @Get()
  async list(@Query('phone') phone?: string) {
    if (!phone) return { error: 'phone query is required to list orders' };
    return this.orders.listByPhone(phone);
  }

  @Post()
  async create(@Body() dto: CreateOrderDto, @Req() req: Request) {
    // eslint-disable-next-line no-console
    console.log('[orders.controller] create called; has service =', !!this.orders);
    try {
  // Best-effort get user from token (optional)
  const bearer = (req.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, '');
  const token = bearer || (req as any).cookies?.access_token;
  const payload = token ? auth.verify(token) : null;
  const userId = (payload as any)?.id as string | undefined;
  const order = await this.orders.create(dto, userId);
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
    } catch (e: any) {
      // Prisma known error mapping
      const code = e?.code as string | undefined;
      const msg = e?.message || 'Failed to create order';
      // eslint-disable-next-line no-console
      const safe = {
        code,
        msg,
        items: Array.isArray((dto as any)?.items) ? (dto as any).items.length : undefined,
        paymentMethod: (dto as any)?.paymentMethod,
      };
      console.error('[orders.create] error:', safe);
      if (e?.stack) {
        // eslint-disable-next-line no-console
        console.error('[orders.create] stack:', e.stack);
      }
      if (code === 'P2002') {
        throw new HttpException('Duplicate data', HttpStatus.BAD_REQUEST);
      }
      const dev = process.env.NODE_ENV !== 'production';
      const body: any = dev ? { message: msg, stack: e?.stack, safe } : msg;
      throw new HttpException(body, HttpStatus.BAD_REQUEST);
    }
  }

  // Authenticated user's order history; falls back to phone matching for legacy orders
  @UseGuards(JwtAuthGuard)
  @Get('my')
  async my(@Req() req: Request) {
    const u = (req as any).user as { id: string };
    return this.orders.listForUser(u.id);
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
