import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock, MockInstance } from 'vitest';

vi.mock('../prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../utils/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('../utils/messaging', async () => {
  const actual = await vi.importActual<typeof import('../utils/messaging')>('../utils/messaging');
  return {
    ...actual,
    sendWhatsAppMessage: vi.fn(),
    sendLineMessage: vi.fn(),
  };
});

import { AuthController } from './auth.controller';
import { prisma } from '../prisma';
import { auth } from './auth.service';
import { sendEmail } from '../utils/email';
import { sendWhatsAppMessage, sendLineMessage } from '../utils/messaging';

const controller = new AuthController();
const prismaUserFindUnique = prisma.user.findUnique as Mock;
const sendEmailMock = vi.mocked(sendEmail);
const sendWhatsAppMock = vi.mocked(sendWhatsAppMessage);
const sendLineMock = vi.mocked(sendLineMessage);

describe('AuthController forgotPassword delivery channels', () => {
  let generateTokenSpy: MockInstance<typeof auth['generatePasswordResetToken']>;

  beforeEach(() => {
    vi.clearAllMocks();
    (process.env as any).NODE_ENV = 'test';
    generateTokenSpy = vi.spyOn(auth, 'generatePasswordResetToken').mockResolvedValue({
      token: 'test-reset-token',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    sendEmailMock.mockResolvedValue({ ok: true });
    sendWhatsAppMock.mockResolvedValue({ ok: true });
    sendLineMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    generateTokenSpy.mockRestore();
  });

  it('queues WhatsApp and email deliveries when WhatsApp succeeds', async () => {
    prismaUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Tester',
      phone: '+66123456789',
      lineUserId: 'line-user-1',
      role: 'customer',
      passwordHash: 'hash',
      refreshTokenHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await controller.forgotPassword({ email: 'user@example.com', channel: 'whatsapp' });

    expect(result.delivery.primary).toBe('whatsapp');
    expect(result.delivery.attempts[0]).toMatchObject({ method: 'whatsapp', status: 'queued' });
    expect(result.delivery.attempts[1]).toMatchObject({ method: 'email', status: 'queued' });
    expect(result.devToken).toBe('test-reset-token');
    expect(sendWhatsAppMock).toHaveBeenCalledWith(expect.objectContaining({ to: '+66123456789' }));
    expect(sendEmailMock).toHaveBeenCalled();
  });

  it('marks WhatsApp delivery as unavailable when messaging not configured', async () => {
    prismaUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Tester',
      phone: '+66123456789',
      lineUserId: 'line-user-1',
      role: 'customer',
      passwordHash: 'hash',
      refreshTokenHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    sendWhatsAppMock.mockResolvedValue({ ok: false, error: 'WhatsApp messaging not configured' });

    const result = await controller.forgotPassword({ email: 'user@example.com', channel: 'whatsapp' });

    expect(result.delivery.primary).toBe('whatsapp');
    expect(result.delivery.attempts[0]).toMatchObject({ method: 'whatsapp', status: 'unavailable' });
    expect(result.delivery.attempts[1]).toMatchObject({ method: 'email' });
  });

  it('marks LINE delivery unavailable when user has no LINE user id', async () => {
    prismaUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Tester',
      phone: '+66123456789',
      lineUserId: null,
      role: 'customer',
      passwordHash: 'hash',
      refreshTokenHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await controller.forgotPassword({ email: 'user@example.com', channel: 'line' });

    expect(result.delivery.primary).toBe('line');
    expect(result.delivery.attempts[0]).toMatchObject({ method: 'line', status: 'unavailable' });
    expect(sendLineMock).not.toHaveBeenCalled();
  });

  it('returns unknown statuses when the user cannot be found', async () => {
    prismaUserFindUnique.mockResolvedValue(null);

    const result = await controller.forgotPassword({ email: 'missing@example.com', channel: 'line' });

    expect(generateTokenSpy).not.toHaveBeenCalled();
    expect(result.delivery.attempts.every((attempt: any) => attempt.status === 'unknown')).toBe(true);
    expect(result.devToken).toBeUndefined();
  });
});
