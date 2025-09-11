import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { verifyWebhookSignature } from '../utils/webhook';
import { buildPromptPayPayload } from '../utils/promptpay';
import { prisma } from '../prisma';

@Controller('api')
export class PaymentsController {
  @Post('payments/promptpay/create')
  async createPromptPay(@Body() body: { orderId: string; amount: number }) {
    const order = await prisma.order.findUnique({ where: { id: body.orderId } });
    const amount = body.amount ?? order?.total ?? 0;
    const qrPayload = buildPromptPayPayload({
      merchantId: process.env.PROMPTPAY_MERCHANT_ID || '0000000000000',
      amount,
    });
    if (order) {
      await prisma.payment.update({
        where: { orderId: order.id },
        data: { promptpayQR: qrPayload, status: 'pending' },
      });
    }
    return { qrPayload };
  }

  @Post('webhooks/promptpay')
  @Get('payments/:orderId/status')
  async status(@Param('orderId') orderId: string) {
    const pay = await prisma.payment.findUnique({ where: { orderId } });
    return { orderId, status: pay?.status ?? 'unknown', paidAt: pay?.paidAt ?? null };
  }
  async promptpayWebhook(
    @Headers('x-signature') signature: string,
    @Body() payload: { orderId: string; status: 'PAID' | 'FAILED'; providerRefId?: string }
  ) {
    const ok = verifyWebhookSignature(signature, payload);
    if (!ok) return { ok: false };

    await prisma.webhookEvent.create({ data: { type: 'promptpay', payload, signature } });

    if (payload.status === 'PAID') {
      await prisma.payment.update({
        where: { orderId: payload.orderId },
        data: { status: 'paid', providerRefId: payload.providerRefId, paidAt: new Date() },
      });
      await prisma.order.update({ where: { id: payload.orderId }, data: { status: 'preparing' } });
    }

    return { ok: true };
  }
}
