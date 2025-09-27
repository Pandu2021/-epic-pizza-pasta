import { Body, Controller, Get, HttpException, HttpStatus, Inject, Param, Post, Query, UseGuards, Req, Patch, Res } from '@nestjs/common';
import { Response } from 'express';
import { OrdersService } from './orders.service';
import { OrdersEvents } from './orders.events';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { Request } from 'express';
import { auth } from '../auth/auth.service';
import fs from 'node:fs'
import path from 'node:path'

@Controller('api/orders')
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService, @Inject(OrdersEvents) private readonly events: OrdersEvents) {
    // eslint-disable-next-line no-console
    console.log('[orders.controller] constructed; orders injected =', !!this.orders);
  }

  @Get()
  async list(@Query('phone') phone?: string) {
    if (!phone) return { error: 'phone query is required to list orders' };
    return this.orders.listByPhone(phone);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateOrderDto, @Req() req: Request) {
    console.log('[orders.controller] create (auth required) called; user =', (req as any).user?.id);
    try {
      const userId = (req as any).user?.id as string; // enforced by JwtAuthGuard
      const order = await this.orders.create(dto, userId);
      return {
        orderId: order?.id,
        status: order?.status,
        amountTotal: order?.total,
        tax: order?.tax,
        deliveryFee: order?.deliveryFee,
        subtotal: order?.subtotal,
        discount: order?.discount,
        expectedReadyAt: (order as any)?.expectedReadyAt,
        expectedDeliveryAt: (order as any)?.expectedDeliveryAt,
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

  @Post(':id/confirm-delivered')
  confirmDelivered(@Param('id') id: string) {
    return this.orders.confirmDelivered(id);
  }

  @Get(':id/eta')
  eta(@Param('id') id: string) {
    return this.orders.eta(id);
  }

  // Reprint endpoint: authenticated user can request a reprint of their own order's receipt
  @UseGuards(JwtAuthGuard)
  @Post(':id/print')
  async print(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user?.id as string;
    try {
      await this.orders.requestPrint(id, userId);
      return { ok: true };
    } catch (e: any) {
      const msg = e?.message || 'Failed to queue print job';
      const status = e?.status || HttpStatus.BAD_REQUEST;
      throw new HttpException({ message: msg }, status);
    }
  }

  // Download receipt as PDF
  @UseGuards(JwtAuthGuard)
  @Get(':id/receipt.pdf')
  async receipt(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    try {
      const userId = (req as any).user?.id as string;
      const { filePath, filename } = await this.orders.generateReceiptForDownload(id, userId);
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (e: any) {
      const msg = e?.message || 'Failed to generate receipt';
      const status = e?.status || HttpStatus.BAD_REQUEST;
      throw new HttpException({ message: msg }, status);
    }
  }

  @Get(':id/stream')
  stream(@Param('id') id: string, @Res() res: Response) {
    this.events.subscribe(id, res);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string; driverName?: string }) {
    return this.orders.updateStatus(id, body.status, body.driverName);
  }
}
