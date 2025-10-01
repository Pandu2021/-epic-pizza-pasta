import { Body, Controller, Get, Headers, HttpException, HttpStatus, Param, Post } from '@nestjs/common';
import * as https from 'node:https';
import { URL } from 'node:url';
import { verifyWebhookSignature } from '../utils/webhook';
import { buildPromptPayPayload } from '../utils/promptpay';
import { prisma } from '../prisma';
import { OrdersPrintService } from '../orders/orders.print';
import { sendEmail } from '../utils/email';
import { enqueue } from '../utils/job-queue';

@Controller('api')
export class PaymentsController {
  constructor(private readonly printer: OrdersPrintService) {}
  // Generate PromptPay QR via local EMVCo builder (legacy)
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

  // Generate PromptPay QR via Omise (preferred for testing end-to-end)
  @Post('payments/omise/promptpay')
  async omisePromptPay(@Body() body: { orderId: string; amount?: number; description?: string }) {
    const secret = process.env.OMISE_SECRET_KEY;
    if (!secret) throw new HttpException('Omise not configured', HttpStatus.SERVICE_UNAVAILABLE);
    if (!body?.orderId) throw new HttpException('Invalid request', HttpStatus.BAD_REQUEST);

    const order = await prisma.order.findUnique({ where: { id: body.orderId }, include: { payment: true } });
    if (!order) throw new HttpException('Order not found', HttpStatus.NOT_FOUND);

    const amountSatang = Math.round(((body.amount ?? order.total ?? 0) as number) * 100);
    if (amountSatang <= 0) throw new HttpException('Amount must be > 0', HttpStatus.BAD_REQUEST);

    const auth = 'Basic ' + Buffer.from(`${secret}:`).toString('base64');

    // Step 1: Create a PromptPay source
    const srcParams = new URLSearchParams();
    srcParams.set('type', 'promptpay');
    srcParams.set('amount', String(amountSatang));
    srcParams.set('currency', 'thb');
    const createSource = async () =>
      await new Promise<any>((resolve, reject) => {
        const u = new URL('https://api.omise.co/sources');
        const payload = srcParams.toString();
        const req = https.request(
          {
            method: 'POST',
            hostname: u.hostname,
            path: u.pathname,
            headers: {
              Authorization: auth,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(payload),
            },
          },
          (res) => {
            let out = '';
            res.setEncoding('utf8');
            res.on('data', (c) => (out += c));
            res.on('end', () => {
              try {
                resolve(out ? JSON.parse(out) : {});
              } catch (e) {
                reject(e);
              }
            });
          },
        );
        req.on('error', reject);
        req.write(payload);
        req.end();
      });

    let source: any;
    try {
      source = await createSource();
    } catch (e: any) {
      throw new HttpException(`Payment gateway error (source): ${e?.message || 'request failed'}`, HttpStatus.BAD_GATEWAY);
    }
    if (source?.object === 'error') {
      const message = (source && (source.message || source.code)) || 'PromptPay source failed';
      throw new HttpException(String(message), HttpStatus.BAD_REQUEST);
    }
    const sourceId: string = source?.id || '';
    if (!sourceId) throw new HttpException('Failed to create payment source', HttpStatus.BAD_GATEWAY);

    // Step 2: Create a charge using the source
    const chParams = new URLSearchParams();
    chParams.set('amount', String(amountSatang));
    chParams.set('currency', 'thb');
    chParams.set('source', sourceId);
    chParams.set('description', body.description || `Order ${order.id} - PromptPay`);
    const createCharge = async () =>
      await new Promise<any>((resolve, reject) => {
        const u = new URL('https://api.omise.co/charges');
        chParams.set('metadata[orderId]', order.id);
        const payload = chParams.toString();
        const req = https.request(
          {
            method: 'POST',
            hostname: u.hostname,
            path: u.pathname,
            headers: {
              Authorization: auth,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(payload),
            },
          },
          (res) => {
            let out = '';
            res.setEncoding('utf8');
            res.on('data', (c) => (out += c));
            res.on('end', () => {
              try {
                resolve(out ? JSON.parse(out) : {});
              } catch (e) {
                reject(e);
              }
            });
          },
        );
        req.on('error', reject);
        req.write(payload);
        req.end();
      });

    let data: any;
    try {
      data = await createCharge();
    } catch (e: any) {
      throw new HttpException(`Payment gateway error (charge): ${e?.message || 'request failed'}`, HttpStatus.BAD_GATEWAY);
    }
    if (data?.object === 'error') {
      const message = (data && (data.message || data.code)) || 'PromptPay charge failed';
      throw new HttpException(String(message), HttpStatus.BAD_REQUEST);
    }

    const chargeId: string = data?.id || '';
    const status: string = data?.status || 'pending';
    const qrImageUrl: string | undefined = data?.source?.scannable_code?.image?.download_uri || data?.source?.scannable_code?.image?.uri || undefined;
    const qrPayload: string | undefined = data?.source?.scannable_code?.data || undefined;

    // Persist payment entry
    await prisma.payment.upsert({
      where: { orderId: order.id },
      update: { status: 'pending', method: 'promptpay', providerRefId: chargeId, promptpayQR: qrPayload || qrImageUrl || null },
      create: { orderId: order.id, method: 'promptpay', status: 'pending', providerRefId: chargeId, promptpayQR: qrPayload || qrImageUrl || null },
    });

    return { ok: true, orderId: order.id, chargeId, status, qrPayload: qrPayload || null, qrImageUrl: qrImageUrl || null };
  }

  @Get('payments/:orderId/status')
  async status(@Param('orderId') orderId: string) {
    const pay = await prisma.payment.findUnique({ where: { orderId } });
    return { orderId, status: pay?.status ?? 'unknown', paidAt: pay?.paidAt ?? null };
  }

  // Card (Omise) charge - test mode supported via OMISE_SECRET_KEY
  @Post('payments/omise/charge')
  async omiseCharge(
    @Body() body: { orderId: string; amount: number; token: string; description?: string }
  ) {
    const secret = process.env.OMISE_SECRET_KEY;
    if (!secret) {
      throw new HttpException('Omise not configured', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!body?.orderId || !body?.token || !(body?.amount >= 1)) {
      throw new HttpException('Invalid request', HttpStatus.BAD_REQUEST);
    }

    const order = await prisma.order.findUnique({ where: { id: body.orderId }, include: { payment: true } });
    if (!order) throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.payment?.status === 'paid') return { ok: true, alreadyPaid: true };

    const amountSatang = Math.round((body.amount || order.total || 0) * 100);
    if (amountSatang <= 0) throw new HttpException('Amount must be > 0', HttpStatus.BAD_REQUEST);

    const params = new URLSearchParams();
    params.set('amount', String(amountSatang));
    params.set('currency', 'thb');
    params.set('card', body.token);
    params.set('description', body.description || `Order ${order.id}`);

    const url = new URL('https://api.omise.co/charges');
    const payload = params.toString();
    const auth = 'Basic ' + Buffer.from(`${secret}:`).toString('base64');

    let data: any;
    try {
      data = await new Promise((resolve, reject) => {
        const req = https.request(
          {
            method: 'POST',
            hostname: url.hostname,
            path: url.pathname,
            headers: {
              'Authorization': auth,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(payload),
            },
          },
          (res) => {
            let out = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => (out += chunk));
            res.on('end', () => {
              try {
                resolve(out ? JSON.parse(out) : {});
              } catch (e) {
                reject(e);
              }
            });
          },
        );
        req.on('error', reject);
        req.write(payload);
        req.end();
      });
    } catch (e: any) {
      throw new HttpException(`Payment gateway error: ${e?.message || 'request failed'}`, HttpStatus.BAD_GATEWAY);
    }

    if (data?.object === 'error') {
      const message = (data && (data.message || data.code)) || 'Charge failed';
      throw new HttpException(String(message), HttpStatus.BAD_REQUEST);
    }

    // Minimal success check: status === 'successful' or paid === true
  const status: string = data?.status || '';
  const paid: boolean = !!data?.paid || status === 'successful';
  const chargeId: string = data?.id || '';

    if (paid) {
      await prisma.payment.upsert({
        where: { orderId: order.id },
        update: { status: 'paid', providerRefId: chargeId, paidAt: new Date() },
        create: { orderId: order.id, method: 'card', status: 'paid', providerRefId: chargeId, paidAt: new Date() },
      });
      await prisma.order.update({ where: { id: order.id }, data: { status: 'preparing' } });

      // Enqueue receipt email with PDF (synchronous charge path)
      const orderIdToEmail = order.id;
      enqueue({
        id: `email:receipt:after-paid:${orderIdToEmail}`,
        run: async () => {
          try {
            const filePath = await this.printer.generateReceipt(orderIdToEmail);
            // Try to find a user email: check order.userId then phone
            const ord = await prisma.order.findUnique({ where: { id: orderIdToEmail }, select: { phone: true, userId: true } });
            let to = process.env.RECEIPT_EMAIL_TO || 'epicpizzaorders@gmail.com';
            if (ord?.userId) {
              const user = await prisma.user.findUnique({ where: { id: ord.userId }, select: { email: true } });
              if (user?.email) to = user.email;
            } else if (ord?.phone) {
              const user = await prisma.user.findFirst({ where: { phone: ord.phone }, select: { email: true } });
              if (user?.email) to = user.email;
            }
            const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
            const filename = `receipt-${String(orderIdToEmail).slice(0,8)}-${ts}.pdf`;
            const subject = `Receipt ${orderIdToEmail}`;
            const html = `<p>Attached is the receipt for order <b>${orderIdToEmail}</b>. Thank you for your payment.</p>`;
            await sendEmail({ to, subject, html, attachments: [{ filename, path: filePath, contentType: 'application/pdf' }] });
          } catch (e) {
            // non-fatal
          }
        },
        maxRetries: 3,
        baseDelayMs: 1000,
      });
    }

    return { ok: paid, chargeId, status };
  }

  // Omise Webhook: update payment status based on charge events
  @Post('webhooks/omise')
  async omiseWebhook(@Body() payload: any) {
    const secret = process.env.OMISE_SECRET_KEY;
    if (!secret) throw new HttpException('Omise not configured', HttpStatus.SERVICE_UNAVAILABLE);

    try {
      // Verify by fetching the event from Omise using the event id
      const eventId: string | undefined = payload?.id;
      let eventData: any = payload;

      if (eventId) {
        eventData = await new Promise((resolve, reject) => {
          const u = new URL(`https://api.omise.co/events/${encodeURIComponent(eventId)}`);
          const auth = 'Basic ' + Buffer.from(`${secret}:`).toString('base64');
          const req = https.request(
            {
              method: 'GET',
              hostname: u.hostname,
              path: u.pathname,
              headers: {
                Authorization: auth,
                Accept: 'application/json',
              },
            },
            (res) => {
              let out = '';
              res.setEncoding('utf8');
              res.on('data', (c) => (out += c));
              res.on('end', () => {
                try {
                  resolve(out ? JSON.parse(out) : {});
                } catch (e) {
                  reject(e);
                }
              });
            },
          );
          req.on('error', reject);
          req.end();
        });
      }

      // Persist webhook event
      await prisma.webhookEvent.create({ data: { type: 'omise', payload: eventData } });

      const obj = eventData?.object;
      const data = eventData?.data;
      if (obj !== 'event' || !data) return { ok: true };

      if (data?.object === 'charge') {
        const chargeId: string = data?.id || '';
        const paid: boolean = !!data?.paid || data?.status === 'successful';
        const orderIdMeta: string | undefined = (data?.metadata && (data.metadata.orderId as string)) || undefined;

        if (paid) {
          let payment = null;
          if (orderIdMeta) {
            payment = await prisma.payment.findUnique({ where: { orderId: orderIdMeta } }).catch(() => null);
          }
          if (!payment && chargeId) {
            payment = await prisma.payment.findFirst({ where: { providerRefId: chargeId } }).catch(() => null);
          }
          if (payment) {
            await prisma.payment.update({
              where: { orderId: payment.orderId },
              data: { status: 'paid', paidAt: new Date(), providerRefId: chargeId || payment.providerRefId },
            });
            await prisma.order.update({ where: { id: payment.orderId }, data: { status: 'preparing' } });

            // Enqueue receipt email with PDF
            const orderIdToEmail = payment.orderId;
            enqueue({
              id: `email:receipt:after-paid:${orderIdToEmail}`,
              run: async () => {
                try {
                  const filePath = await this.printer.generateReceipt(orderIdToEmail);
                  const toCandidate = (await prisma.order.findUnique({ where: { id: orderIdToEmail }, select: { phone: true } }))?.phone;
                  // Try to find a user email if phone linked to user
                  let to = process.env.RECEIPT_EMAIL_TO || 'epicpizzaorders@gmail.com';
                  if (toCandidate) {
                    const user = await prisma.user.findFirst({ where: { phone: toCandidate }, select: { email: true } });
                    if (user?.email) to = user.email;
                  }
                  const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
                  const filename = `receipt-${String(orderIdToEmail).slice(0,8)}-${ts}.pdf`;
                  const subject = `Receipt ${orderIdToEmail}`;
                  const html = `<p>Attached is the receipt for order <b>${orderIdToEmail}</b>. Thank you for your payment.</p>`;
                  await sendEmail({ to, subject, html, attachments: [{ filename, path: filePath, contentType: 'application/pdf' }] });
                } catch (e) {
                  // non-fatal
                }
              },
              maxRetries: 3,
              baseDelayMs: 1000,
            });
          }
        }
      }

      return { ok: true };
    } catch (e: any) {
      // Do not throw to avoid retries storm; log and return ok
      // eslint-disable-next-line no-console
      console.error('[webhooks/omise] error:', e?.message || e);
      return { ok: true };
    }
  }
  @Post('webhooks/promptpay')
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

      // Enqueue receipt email with PDF
      enqueue({
        id: `email:receipt:after-paid:${payload.orderId}`,
        run: async () => {
          try {
            const filePath = await this.printer.generateReceipt(payload.orderId);
            // Try to get user email by associated user or phone
            const order = await prisma.order.findUnique({ where: { id: payload.orderId }, select: { phone: true, userId: true } });
            let to = process.env.RECEIPT_EMAIL_TO || 'epicpizzaorders@gmail.com';
            if (order?.userId) {
              const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { email: true } });
              if (user?.email) to = user.email;
            } else if (order?.phone) {
              const user = await prisma.user.findFirst({ where: { phone: order.phone }, select: { email: true } });
              if (user?.email) to = user.email;
            }
            const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
            const filename = `receipt-${String(payload.orderId).slice(0,8)}-${ts}.pdf`;
            const subject = `Receipt ${payload.orderId}`;
            const html = `<p>Attached is the receipt for order <b>${payload.orderId}</b>. Thank you for your payment.</p>`;
            await sendEmail({ to, subject, html, attachments: [{ filename, path: filePath, contentType: 'application/pdf' }] });
          } catch (e) {
            // non-fatal
          }
        },
        maxRetries: 3,
        baseDelayMs: 1000,
      });
    }

    return { ok: true };
  }
}
