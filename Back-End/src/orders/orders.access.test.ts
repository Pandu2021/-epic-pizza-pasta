import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OrdersService } from './orders.service';
import { prisma } from '../prisma';

type OrderRecord = NonNullable<Awaited<ReturnType<typeof prisma.order.findUnique>>>;
type UserRecord = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;

describe('OrdersService access control helpers', () => {
  const service = new OrdersService({} as any, {} as any);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows admins to access any existing order', async () => {
    vi.spyOn(prisma.order, 'findUnique').mockResolvedValueOnce({
      id: 'ord_admin',
      userId: 'someone-else',
      phone: '+66123456789',
    } as unknown as OrderRecord);

    await expect(
      service.ensureUserOwnsOrderOrAdmin('ord_admin', { id: 'admin-id', role: 'admin' })
    ).resolves.toMatchObject({ id: 'ord_admin' });
  });

  it('allows users to access their own order by userId', async () => {
    vi.spyOn(prisma.order, 'findUnique').mockResolvedValueOnce({
      id: 'ord_user',
      userId: 'user-123',
      phone: '+66123456789',
    } as unknown as OrderRecord);

    await expect(
      service.ensureUserOwnsOrderOrAdmin('ord_user', { id: 'user-123', role: 'customer' })
    ).resolves.toMatchObject({ id: 'ord_user' });
  });

  it('allows users to access orders when phone matches their profile', async () => {
    vi.spyOn(prisma.order, 'findUnique').mockResolvedValueOnce({
      id: 'ord_phone',
      userId: null,
      phone: '+66111222333',
    } as unknown as OrderRecord);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
      phone: '0111222333',
    } as unknown as UserRecord);

    await expect(
      service.ensureUserOwnsOrderOrAdmin('ord_phone', { id: 'user-321', role: 'customer' })
    ).resolves.toMatchObject({ id: 'ord_phone' });
  });

  it('rejects access when user does not own the order', async () => {
    vi.spyOn(prisma.order, 'findUnique').mockResolvedValueOnce({
      id: 'ord_denied',
      userId: 'different-user',
      phone: '+66999999999',
    } as unknown as OrderRecord);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
      phone: '+66888888888',
    } as unknown as UserRecord);

    await expect(
      service.ensureUserOwnsOrderOrAdmin('ord_denied', { id: 'user-abc', role: 'customer' })
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects phone access when phone missing or mismatched', async () => {
    await expect(service.ensurePhoneAccess(undefined, { id: 'user-1', role: 'customer' })).rejects.toMatchObject({ status: 400 });
    await expect(service.ensurePhoneAccess('  ', { id: 'user-1', role: 'customer' })).rejects.toMatchObject({ status: 400 });

  vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({ phone: '+66888888888' } as unknown as UserRecord);
    await expect(service.ensurePhoneAccess('0999999999', { id: 'user-1', role: 'customer' })).rejects.toMatchObject({ status: 403 });
  });
});
