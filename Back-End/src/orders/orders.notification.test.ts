import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrdersNotificationService } from './orders.notification';
import * as queue from '../utils/job-queue';
import * as email from '../utils/email';
import * as messaging from '../utils/messaging';

const sampleOrder = {
  id: 'ord_test_123',
  customerName: 'Guest User',
  customerEmail: 'guest@example.com',
  lineUserId: 'line-guest',
  total: 450,
  status: 'received',
  paymentMethod: 'cod',
  deliveryType: 'delivery',
  User: { email: 'member@example.com', lineUserId: 'line-member', name: 'Member' },
};

describe('OrdersNotificationService', () => {
  const service = new OrdersNotificationService();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(queue, 'enqueue').mockImplementation((opts: any) => {
      void opts.run();
      return 'job';
    });
  });

  it('sends email and line notifications on order creation', async () => {
    const sendEmailMock = vi.spyOn(email, 'sendEmail').mockResolvedValue({ ok: true });
    const sendLineMock = vi.spyOn(messaging, 'sendLineMessage').mockResolvedValue({ ok: true });

    service.notifyOrderCreated(sampleOrder as any, {
      origin: 'guest',
      emailOverride: 'primary@example.com',
      lineOverride: 'line-primary',
      paymentMethod: 'promptpay',
    });

    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'primary@example.com' }));
    expect(sendLineMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'line-primary' }));
  });

  it('falls back to default email when none supplied', async () => {
    const sendEmailMock = vi.spyOn(email, 'sendEmail').mockResolvedValue({ ok: true });
    vi.spyOn(messaging, 'sendLineMessage').mockResolvedValue({ ok: true });

    const orderWithoutContact = { ...sampleOrder, customerEmail: null, lineUserId: null, User: null };
    service.notifyOrderCancelled(orderWithoutContact as any, { refundStatus: 'refunded' });

    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'panduwicaksono2021@gmail.com' }));
  });
});
