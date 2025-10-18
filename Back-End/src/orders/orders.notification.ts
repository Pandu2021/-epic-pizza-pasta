import { Injectable } from '@nestjs/common';
import { enqueue } from '../utils/job-queue';
import { sendEmail } from '../utils/email';
import { sendLineMessage } from '../utils/messaging';

export interface OrderNotificationContext {
  origin?: 'guest' | 'account' | 'system';
  emailOverride?: string | null;
  lineOverride?: string | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  refundStatus?: string | null;
  previousStatus?: string | null;
}

type OrderContact = {
  id: string;
  customerName?: string | null;
  customerEmail?: string | null;
  lineUserId?: string | null;
  phone?: string | null;
  total?: number | null;
  status?: string | null;
  paymentMethod?: string | null;
  deliveryType?: string | null;
  driverName?: string | null;
  User?: {
    email?: string | null;
    lineUserId?: string | null;
    name?: string | null;
  } | null;
};

@Injectable()
export class OrdersNotificationService {
  private readonly fallbackEmail = (process.env.NOTIFY_EMAIL_TO || process.env.RECEIPT_EMAIL_TO || 'panduwicaksono2021@gmail.com').trim();
  private readonly fallbackLine = (process.env.NOTIFY_LINE_TO || process.env.LINE_DEFAULT_USER_ID || '').trim();

  notifyOrderCreated(order: OrderContact, context: OrderNotificationContext = {}) {
    const { emails, lineRecipients } = this.resolveRecipients(order, context);
    const total = this.formatCurrency(order.total);
    const method = (context.paymentMethod || order.paymentMethod || 'unknown').toUpperCase();
    const origin = context.origin || (order?.User?.email ? 'account' : 'guest');
    const subject = `Order ${order.id} received`; 
    const line = this.buildLineHeadline(order, origin);
    const text = `${line}. Total ${total}. Payment ${method}.`;
    const html = `<p>${line}.</p><p>Total: <strong>${total}</strong>. Payment: ${method}.</p>`;
    this.queueEmailBatch(emails, subject, text, html, order.id, 'created');
    this.queueLineBatch(lineRecipients, `${text}` , order.id, 'created');
  }

  notifyOrderStatus(order: OrderContact, context: OrderNotificationContext = {}) {
    const status = (order.status || '').toUpperCase() || 'UPDATED';
    const { emails, lineRecipients } = this.resolveRecipients(order, context);
    const subject = `Order ${order.id} status: ${status}`;
    const total = this.formatCurrency(order.total);
    const text = `Order ${order.id} is now ${status}. Total ${total}.`;
    const driverNote = order.driverName ? ` Driver: ${order.driverName}.` : '';
    const html = `<p>Order <strong>${order.id}</strong> is now <strong>${status}</strong>.</p><p>Total: <strong>${total}</strong>.</p>${driverNote ? `<p>${driverNote}</p>` : ''}`;
    this.queueEmailBatch(emails, subject, text + driverNote, html, order.id, `status-${status.toLowerCase()}`);
    this.queueLineBatch(lineRecipients, `${text}${driverNote}`, order.id, `status-${status.toLowerCase()}`);
  }

  notifyPaymentUpdate(order: OrderContact, context: OrderNotificationContext = {}) {
    const paymentStatus = (context.paymentStatus || 'updated').toUpperCase();
    const method = (context.paymentMethod || order.paymentMethod || 'unknown').toUpperCase();
    const { emails, lineRecipients } = this.resolveRecipients(order, context);
    const subject = `Payment ${paymentStatus} for order ${order.id}`;
    const total = this.formatCurrency(order.total);
    const text = `Payment for order ${order.id} is now ${paymentStatus}. Method ${method}. Total ${total}.`;
    const html = `<p>Payment for order <strong>${order.id}</strong> is now <strong>${paymentStatus}</strong>.</p><p>Method: ${method}. Total: <strong>${total}</strong>.</p>`;
    this.queueEmailBatch(emails, subject, text, html, order.id, `payment-${paymentStatus.toLowerCase()}`);
    this.queueLineBatch(lineRecipients, text, order.id, `payment-${paymentStatus.toLowerCase()}`);
  }

  notifyOrderCancelled(order: OrderContact, context: OrderNotificationContext = {}) {
    const { emails, lineRecipients } = this.resolveRecipients(order, context);
    const refund = context.refundStatus ? ` Refund: ${context.refundStatus}.` : '';
    const subject = `Order ${order.id} cancelled`;
    const text = `Order ${order.id} has been cancelled.${refund}`;
    const html = `<p>Order <strong>${order.id}</strong> has been cancelled.</p>${refund ? `<p>${refund.trim()}.</p>` : ''}`;
    this.queueEmailBatch(emails, subject, text, html, order.id, 'cancelled');
    this.queueLineBatch(lineRecipients, `${text}`, order.id, 'cancelled');
  }

  private resolveRecipients(order: OrderContact, context: OrderNotificationContext) {
    const emailSet = new Set<string>();
    const lineSet = new Set<string>();
    const pushEmail = (value: string | null | undefined) => {
      if (!value) return;
      const trimmed = value.trim().toLowerCase();
      if (trimmed) emailSet.add(trimmed);
    };
    const pushLine = (value: string | null | undefined) => {
      if (!value) return;
      const trimmed = value.trim();
      if (trimmed) lineSet.add(trimmed);
    };

    pushEmail(context.emailOverride);
    pushLine(context.lineOverride);
    pushEmail(order.customerEmail);
    pushLine(order.lineUserId);
    pushEmail(order.User?.email);
    pushLine(order.User?.lineUserId);
    if (!emailSet.size && this.fallbackEmail) pushEmail(this.fallbackEmail);
    if (!lineSet.size && this.fallbackLine) pushLine(this.fallbackLine);

    return {
      emails: Array.from(emailSet),
      lineRecipients: Array.from(lineSet),
    };
  }

  private queueEmailBatch(targets: string[], subject: string, text: string, html: string, orderId: string, tag: string) {
    for (const to of targets) {
      enqueue({
        id: `notify:email:${orderId}:${tag}:${to}`,
        run: async () => {
          await sendEmail({ to, subject, text, html });
        },
        maxRetries: 3,
        baseDelayMs: 500,
      });
    }
  }

  private queueLineBatch(targets: string[], body: string, orderId: string, tag: string) {
    for (const to of targets) {
      enqueue({
        id: `notify:line:${orderId}:${tag}:${to}`,
        run: async () => {
          const res = await sendLineMessage({ to, body });
          if (!res.ok) {
            throw new Error(res.error || `LINE status ${res.responseStatus}`);
          }
        },
        maxRetries: 3,
        baseDelayMs: 500,
      });
    }
  }

  private buildLineHeadline(order: OrderContact, origin: string) {
    const customer = order.customerName || order.User?.name || 'Guest';
    const type = (order.deliveryType || 'delivery').toUpperCase();
    return `Order ${order.id} received (${origin}) for ${customer} - ${type}`;
  }

  private formatCurrency(amount: number | null | undefined) {
    const value = typeof amount === 'number' ? amount : 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'THB', minimumFractionDigits: 2 }).format(value);
  }
}
