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
import { sendEmail } from '../utils/email'

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
      // If customer provided an email in the order DTO, enqueue sending receipt PDF to them.
      try {
        const custEmail = (dto as any)?.customer?.email as string | undefined;
        const orderIdForEmail = order?.id
        if (custEmail && orderIdForEmail) {
          // Fire-and-forget: generate PDF and email to customer (best-effort)
          (async () => {
            try {
              const { filePath } = await this.orders.generateReceiptForDownload(orderIdForEmail, (req as any).user?.id || '');
              const ts = order?.createdAt ? new Date(order.createdAt as any).toISOString().slice(0,19).replace(/[:T]/g,'-') : 'receipt';
              const filename = `receipt-${String(orderIdForEmail).slice(0,8)}-${ts}.pdf`;
              const subject = `Pesanan Anda diterima - ${orderIdForEmail}`;
              const html = `<p>Terima kasih! Terlampir adalah bukti pesanan Anda (Order <b>${orderIdForEmail}</b>).</p>`;
              await sendEmail({ to: custEmail, subject, html, attachments: [{ filename, path: filePath, contentType: 'application/pdf' }] });
            } catch (e) {
              // eslint-disable-next-line no-console
              console.warn('[orders.controller] failed to email receipt to customer (non-fatal):', (e as any)?.message || e);
            }
          })()
        }
      } catch (e) {
        // swallow errors
      }
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

  // Email receipt as PDF attachment to a target email (defaults to epicpizzaorders@gmail.com)
  @UseGuards(JwtAuthGuard)
  @Post(':id/email-receipt')
  async emailReceipt(@Param('id') id: string, @Req() req: Request, @Body() body: { to?: string }) {
    try {
      const userId = (req as any).user?.id as string
      const { filePath, filename } = await this.orders.generateReceiptForDownload(id, userId)
      const to = body?.to || process.env.RECEIPT_EMAIL_TO || 'epicpizzaorders@gmail.com'
      const subject = `Receipt ${id}`
      const html = `<p>Attached is the receipt for order <b>${id}</b>.</p>`
      await sendEmail({ to, subject, html, attachments: [{ filename, path: filePath, contentType: 'application/pdf' }] })
      return { ok: true, to }
    } catch (e: any) {
      const msg = e?.message || 'Failed to email receipt'
      const status = e?.status || HttpStatus.BAD_REQUEST
      throw new HttpException({ message: msg }, status)
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
