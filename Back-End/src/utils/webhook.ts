import crypto from 'crypto';

export function verifyWebhookSignature(signature: string, payload: unknown): boolean {
  const secret = process.env.PROMPTPAY_WEBHOOK_SECRET || '';
  const data = JSON.stringify(payload);
  const h = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return !!signature && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(signature));
}
