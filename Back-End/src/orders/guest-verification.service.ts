import { BadRequestException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sendEmail } from '../utils/email';
import { sendWhatsAppMessage } from '../utils/messaging';
import { normalizeThaiPhone } from '../utils/phone';

export type GuestVerificationChannel = 'email' | 'phone';

type VerificationRequest = {
  id: string;
  channel: GuestVerificationChannel;
  target: string;
  code: string;
  expiresAt: number;
  attempts: number;
  verifiedAt?: number;
  verificationToken?: string;
  verificationExpiresAt?: number;
};

export type VerificationResult = {
  channel: GuestVerificationChannel;
  target: string;
  verifiedAt: Date;
};

const REQUEST_TTL_MS = 10 * 60 * 1000; // 10 minutes
const VERIFIED_TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

@Injectable()
export class GuestVerificationService implements OnModuleDestroy {
  private readonly requests = new Map<string, VerificationRequest>();
  private readonly tokens = new Map<string, VerificationRequest>();
  private readonly cleanupHandle: NodeJS.Timeout;

  constructor() {
    this.cleanupHandle = setInterval(() => this.prune(), 60_000);
    if (typeof this.cleanupHandle.unref === 'function') this.cleanupHandle.unref();
  }

  onModuleDestroy() {
    clearInterval(this.cleanupHandle);
  }

  async request(body: { channel: GuestVerificationChannel; target: string }) {
    const channel = body.channel;
    if (channel === 'phone') {
      throw new BadRequestException('Phone/WhatsApp verification is temporarily unavailable. Please use email OTP.');
    }
    const normalizedTarget = this.normalizeTarget(channel, body.target);
    if (!normalizedTarget) {
      throw new BadRequestException('Invalid verification target');
    }

    const code = this.generateCode();
    const id = randomUUID();
    const expiresAt = Date.now() + REQUEST_TTL_MS;

    const record: VerificationRequest = {
      id,
      channel,
      target: normalizedTarget,
      code,
      expiresAt,
      attempts: 0,
    };
    this.requests.set(id, record);

    try {
      if (channel === 'email') {
        const subject = 'Your Epic Pizza & Pasta verification code';
        const text = `Your verification code is ${code}. It expires in 10 minutes.`;
        const html = `<p>Your verification code is <strong>${code}</strong>.</p><p>This code expires in 10 minutes.</p>`;
        await sendEmail({ to: normalizedTarget, subject, text, html });
      } else {
        const result = await sendWhatsAppMessage({ to: normalizedTarget, body: `Epic Pizza & Pasta verification code: ${code}. Expires in 10 minutes.` });
        if (!result.ok) {
          throw new Error(result.error || 'Failed to send verification message');
        }
      }
    } catch (err: any) {
      this.requests.delete(id);
      const message = err?.message || 'Failed to send verification code';
      throw new BadRequestException(message);
    }

    return { requestId: id, expiresAt: new Date(expiresAt).toISOString() };
  }

  confirm(body: { requestId: string; code: string }) {
    const record = this.requests.get(body.requestId);
    if (!record) {
      throw new BadRequestException('Verification request not found or expired');
    }
    if (record.expiresAt <= Date.now()) {
      this.requests.delete(body.requestId);
      throw new BadRequestException('Verification code expired');
    }

    const sanitizedCode = (body.code || '').trim();
    if (!sanitizedCode || sanitizedCode !== record.code) {
      record.attempts += 1;
      if (record.attempts >= 5) {
        this.requests.delete(body.requestId);
      }
      throw new BadRequestException('Invalid verification code');
    }

    const verifiedAt = Date.now();
    const verificationToken = randomUUID();
    const verificationExpiresAt = verifiedAt + VERIFIED_TOKEN_TTL_MS;

    record.verifiedAt = verifiedAt;
    record.verificationToken = verificationToken;
    record.verificationExpiresAt = verificationExpiresAt;

    this.tokens.set(verificationToken, record);
    this.requests.delete(body.requestId);

    return {
      verificationToken,
      expiresAt: new Date(verificationExpiresAt).toISOString(),
    } as const;
  }

  consumeToken(token: string | undefined | null, params: { email?: string | null; phone?: string | null }) : VerificationResult | null {
    if (!token) return null;
    const record = this.tokens.get(token);
    if (!record) return null;
    if (!record.verificationExpiresAt || record.verificationExpiresAt <= Date.now()) {
      this.tokens.delete(token);
      return null;
    }

    const { channel, target } = record;
    if (channel === 'email') {
      const email = (params.email || '').trim().toLowerCase();
      if (!email || email !== target) {
        return null;
      }
    } else {
      const normalizedPhone = this.normalizeTarget('phone', params.phone || '');
      if (!normalizedPhone || normalizedPhone !== target) {
        return null;
      }
    }

    this.tokens.delete(token);
    return { channel, target, verifiedAt: new Date(record.verifiedAt || Date.now()) };
  }

  private normalizeTarget(channel: GuestVerificationChannel, target: string | null | undefined): string | null {
    if (channel === 'email') {
      const trimmed = (target || '').trim().toLowerCase();
      if (!trimmed) return null;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return null;
      return trimmed;
    }
    const normalized = normalizeThaiPhone(target || '');
    if (!normalized) return null;
    return normalized;
  }

  private generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private prune() {
    const now = Date.now();
    for (const [id, record] of this.requests.entries()) {
      if (record.expiresAt <= now) {
        this.requests.delete(id);
      }
    }
    for (const [token, record] of this.tokens.entries()) {
      if (!record.verificationExpiresAt || record.verificationExpiresAt <= now) {
        this.tokens.delete(token);
      }
    }
  }
}
