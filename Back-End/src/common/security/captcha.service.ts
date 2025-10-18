import { Injectable, Logger } from '@nestjs/common';

type RecaptchaResponse = {
  success?: boolean;
  challenge_ts?: string;
  hostname?: string;
  score?: number;
  action?: string;
  'error-codes'?: string[];
};

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger('CaptchaService');
  private readonly secret: string | null;
  private readonly bypassToken: string | null;

  constructor() {
    const secret = (process.env.RECAPTCHA_SECRET_KEY || process.env.RECAPTCHA_SECRET || '').trim();
    this.secret = secret || null;

    if (process.env.NODE_ENV === 'production') {
      this.bypassToken = null;
    } else {
      const bypass = (process.env.RECAPTCHA_BYPASS_TOKEN || process.env.CAPTCHA_BYPASS_TOKEN || 'test-pass').trim();
      this.bypassToken = bypass || null;
    }
  }

  isEnabled(): boolean {
    return !!this.secret;
  }

  async verify(token?: string | null, remoteIp?: string | null): Promise<boolean> {
    if (!this.isEnabled()) {
      return true;
    }
    const trimmed = (token || '').trim();
    if (!trimmed) {
      return false;
    }

    if (this.bypassToken && trimmed === this.bypassToken) {
      return true;
    }

    try {
      const params = new URLSearchParams();
      params.set('secret', this.secret!);
      params.set('response', trimmed);
      if (remoteIp) {
        params.set('remoteip', remoteIp);
      }

      const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });

      if (!res.ok) {
        this.logger.warn(`reCAPTCHA verification HTTP ${res.status}`);
        return false;
      }

      const data = (await res.json()) as RecaptchaResponse;
      if (data?.success) {
        return true;
      }

      const codes = data?.['error-codes'];
      if (codes?.length) {
        this.logger.warn(`reCAPTCHA rejected: ${codes.join(', ')}`);
      }
      return false;
    } catch (err: any) {
      this.logger.error(`reCAPTCHA verification failed: ${err?.message || err}`);
      return false;
    }
  }
}
