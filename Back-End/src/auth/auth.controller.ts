import { Body, Controller, Get, Post, Query, Req, Res, UseGuards, ConflictException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { prisma } from '../prisma';
import * as argon2 from 'argon2';
import { Response, Request, CookieOptions } from 'express';
import { auth } from './auth.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { sendEmail } from '../utils/email';
import { sendWhatsAppMessage, sendLineMessage, maskPhone, maskLineId } from '../utils/messaging';
import { createOAuthState, consumeOAuthState } from './oauth.state';
import { google } from 'googleapis';
import { ensureBuiltInAdminAccount, isBuiltInAdminEmail } from './admin-accounts';

const CSRF_COOKIE_DOMAIN = process.env.COOKIE_DOMAIN?.trim() || undefined;

function resolveCookieDomain(req: Request): string | undefined {
  if (CSRF_COOKIE_DOMAIN) {
    return CSRF_COOKIE_DOMAIN;
  }
  const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim();
  const host = forwardedHost || req.hostname;
  if (!host) return undefined;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
    return undefined;
  }
  const lowerHost = host.toLowerCase();
  if (lowerHost.startsWith('api.')) {
    return `.${host.substring(4)}`;
  }
  return undefined;
}

function maskEmail(email: string) {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const domainParts = domain.split('.');
  const domainName = domainParts.shift() ?? '';
  const maskSegment = (segment: string) => {
    if (!segment) return segment;
    if (segment.length <= 2) return `${segment[0] ?? ''}***`;
    return `${segment[0]}***${segment[segment.length - 1]}`;
  };
  const maskedUser = maskSegment(user);
  const maskedDomain = [maskSegment(domainName), ...domainParts].filter(Boolean).join('.');
  return `${maskedUser}@${maskedDomain}`;
}

function validatePasswordPolicy(password: string) {
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new BadRequestException('Password must be at least 8 characters and include letters and numbers');
  }
  const weakList = new Set(['password', 'password1', '12345678', '123456789', 'qwerty123']);
  if (weakList.has(password.toLowerCase())) {
    throw new BadRequestException('Password too common');
  }
}

function isUniqueLineUserIdError(err: any): boolean {
  if (!err || err.code !== 'P2002') return false;
  const target = err.meta?.target;
  if (Array.isArray(target) && target.some((item: unknown) => typeof item === 'string' && item.includes('lineUserId'))) {
    return true;
  }
  if (typeof target === 'string' && target.includes('lineUserId')) {
    return true;
  }
  const column = err.meta?.column_name || err.meta?.columnName;
  if (typeof column === 'string' && column.includes('lineUserId')) {
    return true;
  }
  const message = typeof err.message === 'string' ? err.message : '';
  return message.includes('lineUserId');
}

function shouldRetryWithoutLineUserId(err: any): boolean {
  if (!err) return false;
  if (err.code === 'P2010') {
    const meta = err.meta ?? {};
    const dbCode = meta.code || meta.dbErrorCode || meta.errorCode;
    const metaMessage = typeof meta.message === 'string' ? meta.message : '';
    const column = meta.column_name || meta.columnName;
    if (column && typeof column === 'string' && column.includes('lineUserId')) {
      return true;
    }
    if (dbCode === '42703' || dbCode === '42P01') {
      return true;
    }
    const message = typeof err.message === 'string' ? err.message : '';
    return metaMessage.includes('lineUserId') || message.includes('lineUserId');
  }
  if (err.code === 'P2021') {
    const message = typeof err.message === 'string' ? err.message : '';
    return message.includes('lineUserId');
  }
  return false;
}

type ResetDeliveryChannel = 'email' | 'whatsapp' | 'line';
type ResetDeliveryStatus = 'queued' | 'unavailable' | 'error' | 'unknown';
type ResetDeliveryAttempt = {
  method: ResetDeliveryChannel;
  status: ResetDeliveryStatus;
  hint: string;
  target?: string | null;
  devNote?: string;
};

const DELIVERY_HINTS: Record<ResetDeliveryChannel, string> = {
  email: 'We\'ll email your reset link to the address on file.',
  whatsapp: 'If your account lists a WhatsApp number, we\'ll send the reset link there shortly.',
  line: 'If your account is connected to our LINE chat, we\'ll send the reset link there.',
};

type VerificationEmailUser = { id: string; email: string; name?: string | null };

function buildVerificationLinks(token: string) {
  const apiBase = (process.env.API_BASE_URL || 'http://localhost:4000/api').replace(/\/$/, '');
  const webBase = (process.env.WEB_APP_BASE_URL || process.env.PUBLIC_WEB_URL || '').replace(/\/$/, '');
  const apiUrl = `${apiBase}/auth/verify-email?token=${encodeURIComponent(token)}`;
  const webUrl = webBase ? `${webBase}/verify-email?token=${encodeURIComponent(token)}` : null;
  return { apiUrl, webUrl, primaryUrl: webUrl || apiUrl };
}

async function sendVerificationEmail(user: VerificationEmailUser, token: string, expiresAt: Date) {
  const ttlMs = Number(process.env.EMAIL_VERIFICATION_TOKEN_TTL_MS || 1000 * 60 * 60 * 24);
  const expiresInHours = Math.max(1, Math.round(ttlMs / (60 * 60 * 1000)));
  const { apiUrl, webUrl, primaryUrl } = buildVerificationLinks(token);
  const subject = 'Verify your Epic Pizza & Pasta email';
  const greetingName = user.name ? `${user.name}` : 'there';
  const textLines = [
    `Hi ${greetingName},`,
    '',
    'Thanks for creating an Epic Pizza & Pasta account. Please verify your email so we can keep your account secure and send you order updates.',
    '',
    `Verify your email: ${primaryUrl}`,
    '',
    `This link expires in about ${expiresInHours} hour${expiresInHours === 1 ? '' : 's'} (on ${expiresAt.toUTCString()}).`,
    '',
    'If you did not create this account, you can ignore this email.',
  ];
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0f172a;margin:0;padding:24px;background:#f8fafc;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;padding:32px;border-radius:12px;box-shadow:0 12px 40px rgba(15,23,42,0.08);">
      <h1 style="margin:0 0 16px;font-size:24px;color:#ef4444;">Confirm your email</h1>
      <p style="margin:0 0 16px;font-size:16px;color:#1e293b;">Hi ${greetingName},</p>
      <p style="margin:0 0 24px;font-size:16px;color:#1e293b;">Thanks for joining Epic Pizza & Pasta! Click the button below to verify your email address so we can send you order updates and special offers.</p>
      <p style="margin:0 0 32px;text-align:center;">
        <a href="${primaryUrl}" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:999px;">Verify email</a>
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#475569;">If the button does not work, copy and paste this link into your browser:<br /><a href="${primaryUrl}" style="color:#ef4444;word-break:break-all;">${primaryUrl}</a></p>
      <p style="margin:0 0 16px;font-size:14px;color:#475569;">This link expires in about ${expiresInHours} hour${expiresInHours === 1 ? '' : 's'} (on ${expiresAt.toUTCString()}).</p>
      ${webUrl && webUrl !== apiUrl ? `<p style="margin:0 0 12px;font-size:13px;color:#64748b;">Prefer the mobile app? Use this link instead:<br /><a href="${apiUrl}" style="color:#ef4444;word-break:break-all;">${apiUrl}</a></p>` : ''}
      <p style="margin:32px 0 0;font-size:14px;color:#475569;">If you did not create this account, you can ignore this message.</p>
      <p style="margin:16px 0 0;font-size:14px;color:#475569;">Stay saucy,<br/>Epic Pizza & Pasta</p>
    </div>
  </body></html>`;

  await sendEmail({ to: user.email, subject, text: textLines.join('\n'), html });
}

function verificationHtmlTemplate(title: string, message: string, success: boolean) {
  const accent = success ? '#16a34a' : '#ef4444';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${title}</title>
  <style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;}section{background:#fff;padding:32px;border-radius:16px;box-shadow:0 20px 60px rgba(15,23,42,0.12);max-width:420px;text-align:center;}h1{margin-bottom:12px;font-size:24px;color:${accent};}p{margin:12px 0;font-size:16px;line-height:1.5;color:#1f2937;}footer{margin-top:24px;font-size:12px;color:#64748b;}</style></head><body>
  <section>
    <h1>${title}</h1>
    <p>${message}</p>
    <footer>Epic Pizza & Pasta</footer>
  </section>
  </body></html>`;
}

@Controller('api/auth')
export class AuthController {
  // ----- OAuth: Google -----
  @Get('google')
  async googleStart(@Res() res: Response, @Query('redirect') redirect?: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const callbackURL = (process.env.GOOGLE_OAUTH_CALLBACK_URL || '').trim();
    if (!clientId || !clientSecret || !callbackURL) {
      throw new BadRequestException('Google OAuth is not configured');
    }
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, callbackURL);
    const { state } = createOAuthState({ provider: 'google', redirectTo: redirect });
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      state,
      include_granted_scopes: true,
      prompt: 'consent',
    });
    res.redirect(authUrl);
  }

  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response, @Query('code') code?: string, @Query('state') state?: string) {
    try {
      if (!code || !state) throw new BadRequestException('Missing code/state');
      const rec = consumeOAuthState(state, 'google');
      if (!rec) throw new BadRequestException('Invalid or expired state');
      const clientId = process.env.GOOGLE_CLIENT_ID || '';
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
      const callbackURL = (process.env.GOOGLE_OAUTH_CALLBACK_URL || '').trim();
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, callbackURL);
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);
      const idToken = tokens.id_token;
      if (!idToken) throw new BadRequestException('No id_token from Google');
      const ticket = await oauth2Client.verifyIdToken({ idToken, audience: clientId });
      const payload = ticket.getPayload();
      const email = (payload?.email || '').toLowerCase();
      const emailVerified = Boolean(payload?.email_verified);
      const name = payload?.name || payload?.given_name || null;
      if (!email) throw new BadRequestException('Email not available from Google');

      let user = await prisma.user.findUnique({ where: { email } }).catch(() => null);
      if (!user) {
        // JIT create user without password (set random hash)
        const rnd = require('crypto').randomBytes(24).toString('hex');
        const pwd = await argon2.hash(rnd);
        user = await prisma.user.create({ data: { email, passwordHash: pwd, name, emailVerifiedAt: emailVerified ? new Date() : null } });
      } else if (emailVerified && !(user as any).emailVerifiedAt) {
        // Upgrade verification if Google confirms
        try { await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } }); } catch {}
      }

      const claims = { id: user.id, email: user.email, role: user.role };
      const access = auth.signAccess(claims);
      const refresh = auth.signRefresh(claims);
      await auth.storeRefreshToken(user.id, refresh);
      const cookieOpts = {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      };
      res.cookie('access_token', access, { ...cookieOpts, maxAge: 15 * 60 * 1000 });
      res.cookie('refresh_token', refresh, { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 * 1000 });

      const destBase = (process.env.WEB_APP_BASE_URL || process.env.PUBLIC_WEB_URL || '/');
      const dest = rec.redirectTo ? rec.redirectTo : `${destBase.replace(/\/$/, '')}/profile`;
      res.redirect(dest);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[oauth][google] callback error', err?.message || err);
      res.status(400).send('Google sign-in failed');
    }
  }

  // ----- OAuth: LINE -----
  @Get('line')
  async lineStart(@Res() res: Response, @Query('redirect') redirect?: string) {
    const clientId = process.env.LINE_CHANNEL_ID || '';
    const callbackURL = (process.env.LINE_OAUTH_CALLBACK_URL || '').trim();
    if (!clientId || !callbackURL) {
      throw new BadRequestException('LINE OAuth is not configured');
    }
    const { state, nonce } = createOAuthState({ provider: 'line', redirectTo: redirect });
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: callbackURL,
      scope: 'openid profile email',
      state,
      nonce,
      ui_locales: 'en',
    });
    const authUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
    res.redirect(authUrl);
  }

  @Get('line/callback')
  async lineCallback(@Req() _req: Request, @Res() res: Response, @Query('code') code?: string, @Query('state') state?: string) {
    try {
      if (!code || !state) throw new BadRequestException('Missing code/state');
      const rec = consumeOAuthState(state, 'line');
      if (!rec) throw new BadRequestException('Invalid or expired state');
      const clientId = process.env.LINE_CHANNEL_ID || '';
      const clientSecret = process.env.LINE_CHANNEL_SECRET || '';
      const callbackURL = (process.env.LINE_OAUTH_CALLBACK_URL || '').trim();
      if (!clientId || !clientSecret || !callbackURL) throw new BadRequestException('LINE OAuth misconfigured');
      // Exchange code for token
      const params = new URLSearchParams();
      params.set('grant_type', 'authorization_code');
      params.set('code', code);
      params.set('redirect_uri', callbackURL);
      params.set('client_id', clientId);
      params.set('client_secret', clientSecret);
      const tokenRes = await (globalThis as any).fetch('https://api.line.me/oauth2/v2.1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      if (!tokenRes.ok) throw new BadRequestException('LINE token exchange failed');
      const tokenJson: any = await tokenRes.json();
      const idToken = tokenJson.id_token as string;
      if (!idToken) throw new BadRequestException('LINE id_token missing');
      // Verify id_token
      const verifyParams = new URLSearchParams({ id_token: idToken, client_id: clientId });
  const verifyRes = await (globalThis as any).fetch('https://api.line.me/oauth2/v2.1/verify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: verifyParams.toString() });
      if (!verifyRes.ok) throw new BadRequestException('LINE verify failed');
      const verify: any = await verifyRes.json();
      const sub = verify.sub as string; // user id
      const email = (verify.email as string | undefined)?.toLowerCase();
      const name = (verify.name as string | undefined) || null;
      if (!sub) throw new BadRequestException('LINE user id missing');

      let user = null as any;
      if (email) {
        user = await prisma.user.findUnique({ where: { email } }).catch(() => null);
      }
      if (!user) {
        // Try find by linked lineUserId
        user = await prisma.user.findFirst({ where: { lineUserId: sub } }).catch(() => null);
      }
      if (!user) {
        // Create new user with placeholder email if absent
        const rnd = require('crypto').randomBytes(24).toString('hex');
        const pwd = await argon2.hash(rnd);
        const emailToUse = email || `line_${sub}@users.line.local`;
        try {
          user = await prisma.user.create({ data: { email: emailToUse, passwordHash: pwd, name, lineUserId: sub, emailVerifiedAt: email ? new Date() : null } });
        } catch (err: any) {
          if (isUniqueLineUserIdError(err)) {
            user = await prisma.user.findFirst({ where: { lineUserId: sub } });
          } else if (shouldRetryWithoutLineUserId(err)) {
            user = await prisma.user.create({ data: { email: emailToUse, passwordHash: pwd, name, emailVerifiedAt: email ? new Date() : null } });
          } else if (err?.code === 'P2002' && email) {
            // email unique conflict: attach line id
            user = await prisma.user.update({ where: { email }, data: { lineUserId: sub } });
          } else {
            throw err;
          }
        }
      } else if (!user.lineUserId) {
        try { user = await prisma.user.update({ where: { id: user.id }, data: { lineUserId: sub } }); } catch {}
      }

      const claims = { id: user.id, email: user.email, role: user.role };
      const access = auth.signAccess(claims);
      const refresh = auth.signRefresh(claims);
      await auth.storeRefreshToken(user.id, refresh);
      const cookieOpts = {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      };
      res.cookie('access_token', access, { ...cookieOpts, maxAge: 15 * 60 * 1000 });
      res.cookie('refresh_token', refresh, { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 * 1000 });

      const destBase = (process.env.WEB_APP_BASE_URL || process.env.PUBLIC_WEB_URL || '/');
      const dest = rec.redirectTo ? rec.redirectTo : `${destBase.replace(/\/$/, '')}/profile`;
      res.redirect(dest);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[oauth][line] callback error', err?.message || err);
      res.status(400).send('LINE sign-in failed');
    }
  }
  @Post('register')
  async register(
  @Body() body: { email: string; password: string; name?: string; phone?: string; lineUserId?: string },
  @Res({ passthrough: true }) _res: Response,
  ) {
    // Normalize & basic field extraction
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const name = (body.name || '').trim() || null;
  const phoneRaw = (body.phone || '').trim();
  const lineRaw = (body.lineUserId || '').trim();

    // Validation: email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    if (!email || !emailRegex.test(email)) {
      throw new BadRequestException('Invalid email');
    }

    // Password policy: length >= 8, at least one letter, one number, optional: encourage special char
    validatePasswordPolicy(password);

    // Phone normalization: keep only digits and plus, basic length check (optional field)
    let phone: string | null = null;
    if (phoneRaw) {
      const digits = phoneRaw.replace(/[^+\d]/g, '');
      if (digits.length < 7 || digits.length > 20) {
        throw new BadRequestException('Invalid phone number');
      }
      phone = digits;
    }

    let lineUserId: string | null = null;
    if (lineRaw) {
      if (!/^[A-Za-z0-9_-]{3,128}$/.test(lineRaw)) {
        throw new BadRequestException('Invalid LINE identifier');
      }
      lineUserId = lineRaw;
    }

    const passwordHash = await argon2.hash(password);
    const verifiedAt = new Date();
    const baseCreateData = {
      email,
      passwordHash,
      name,
      phone,
      lineUserId,
      emailVerifiedAt: verifiedAt,
    };
    let user: Awaited<ReturnType<typeof prisma.user.create>>;
    try {
      user = await prisma.user.create({ data: baseCreateData });
    } catch (err: any) {
      if (shouldRetryWithoutLineUserId(err)) {
        // eslint-disable-next-line no-console
        console.warn('[auth] user table missing lineUserId column; retrying registration without LINE linkage');
        const fallbackData = {
          email,
          passwordHash,
          name,
          phone,
          emailVerifiedAt: verifiedAt,
        };
        user = await prisma.user.create({ data: fallbackData });
      } else if (err?.code === 'P2002') {
        if (isUniqueLineUserIdError(err)) {
          throw new ConflictException('LINE ID already in use');
        }
        throw new ConflictException('Email already in use');
      } else {
        // eslint-disable-next-line no-console
        console.error('[auth] register failed', err?.message || err);
        throw err;
      }
    }
    const emailVerified = true;

    return {
      ok: true,
      id: user.id,
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? undefined,
        phone: user.phone ?? undefined,
        lineUserId: user.lineUserId ?? undefined,
        role: user.role,
        emailVerified,
      },
      verification: {
        autoVerified: true,
        verifiedAt: verifiedAt.toISOString(),
        emailSent: false,
        expiresAt: null,
      },
    };
  }

  @Get('verify-email')
  async verifyEmailLanding(@Query('token') token: string | undefined, @Res() res: Response) {
    const fail = (status: number, title: string, message: string) => {
      res.status(status).type('html').send(verificationHtmlTemplate(title, message, false));
    };
    if (!token || typeof token !== 'string') {
      fail(400, 'Verification failed', 'Verification token is missing. Please use the latest link from your email.');
      return;
    }
    try {
      const record = await auth.findValidEmailVerificationToken(token);
      if (!record) {
        fail(400, 'Verification expired', 'This verification link is invalid or has already been used. Please request a new verification email.');
        return;
      }
      await auth.consumeEmailVerificationToken(record);
      res
        .status(200)
        .type('html')
        .send(verificationHtmlTemplate('Email verified 🎉', 'Your email address has been confirmed. You can close this tab and return to Epic Pizza & Pasta.', true));
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[auth] verification landing error', err?.message || err);
      fail(500, 'Something went wrong', 'We could not verify your email right now. Please try again or request a new link.');
    }
  }

  @Post('verify-email')
  async verifyEmailViaPost(@Body() body: { token?: string }) {
    const token = (body.token || '').trim();
    if (!token) {
      throw new BadRequestException('Verification token required');
    }
    const record = await auth.findValidEmailVerificationToken(token);
    if (!record) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    const verifiedAt = await auth.consumeEmailVerificationToken(record);
    return { ok: true, verifiedAt: verifiedAt.toISOString(), userId: record.userId };
  }

  @UseGuards(JwtAuthGuard)
  @Post('resend-verification')
  async resendVerification(@Req() req: Request) {
    const authUser = (req as any).user as { id: string };
    const user = await prisma.user.findUnique({ where: { id: authUser.id } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const emailVerified = Boolean((user as any).emailVerifiedAt);
    if (emailVerified) {
      return { ok: true, alreadyVerified: true };
    }
    const { token, expiresAt } = await auth.generateEmailVerificationToken(user.id);
    let emailSent = false;
    try {
      await sendVerificationEmail({ id: user.id, email: user.email, name: user.name }, token, expiresAt);
      emailSent = true;
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[auth] failed to resend verification email', err?.message || err);
    }
    return { ok: true, emailSent, expiresAt: expiresAt.toISOString() };
  }

  @Post('login')
    async login(
    @Body() body: { email: string; password: string; context?: 'admin' | 'customer' },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = (body.email || '').trim().toLowerCase();

      // Simple lockout: 5 failed attempts per 15 minutes per email+IP
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
      const key = `${email}|${ip}`;
      const now = Date.now();
      const windowMs = 15 * 60 * 1000;
      const maxAttempts = 5;
      (global as any).__loginFail ||= new Map<string, { count: number; first: number }>();
      const store: Map<string, { count: number; first: number }> = (global as any).__loginFail;
      const rec = store.get(key);
      if (rec && now - rec.first < windowMs && rec.count >= maxAttempts) {
        (req as any)?.log?.warn({ email, ip, count: rec.count }, 'login lockout');
        throw new HttpException('Too many login attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
      }

      const isAdminContext = (body.context || '').toLowerCase() === 'admin';
      if (isAdminContext && isBuiltInAdminEmail(email)) {
        try {
          await ensureBuiltInAdminAccount(email);
        } catch (seedErr: any) {
          (req as any)?.log?.error({ email, seedErr }, 'failed to ensure built-in admin account');
        }
      }

      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        const r = rec && now - rec.first < windowMs ? { count: rec.count + 1, first: rec.first } : { count: 1, first: now };
        store.set(key, r);
        (req as any)?.log?.warn({ email, ip, count: r.count }, 'login failed: user not found');
        return { ok: false };
      }
      const ok = await argon2.verify(user.passwordHash, body.password);
      if (!ok) {
        const r = rec && now - rec.first < windowMs ? { count: rec.count + 1, first: rec.first } : { count: 1, first: now };
        store.set(key, r);
        (req as any)?.log?.warn({ userId: user.id, email, ip, count: r.count }, 'login failed: bad password');
        return { ok: false };
      }
      if (!(user as any).emailVerifiedAt) {
        try {
          user = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
          (req as any)?.log?.info({ userId: user.id, email, ip }, 'login auto-verified email');
        } catch (updateErr: any) {
          (req as any)?.log?.warn({ userId: user.id, email, ip, updateErr }, 'login auto-verification failed');
        }
      }
      const emailVerified = Boolean((user as any).emailVerifiedAt);

      if (isAdminContext) {
        if (!isBuiltInAdminEmail(email)) {
          (req as any)?.log?.warn({ email, ip }, 'login blocked: email not in admin whitelist');
          return { ok: false, reason: 'not_allowed' };
        }
        const allowed = new Set(['admin', 'manager', 'staff']);
        if (!allowed.has((user.role || '').toLowerCase())) {
          (req as any)?.log?.warn({ userId: user.id, email, ip, role: user.role }, 'login blocked: insufficient role for admin context');
          return { ok: false, reason: 'insufficient_role' };
        }
      }

      // success: reset counter
      store.delete(key);
      (req as any)?.log?.info({ userId: user.id, email, ip }, 'login success');

  const payload = { id: user.id, email: user.email, role: user.role };
  const access = auth.signAccess(payload);
  const refresh = auth.signRefresh(payload);
  await auth.storeRefreshToken(user.id, refresh);
    const cookieOpts = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };
    res.cookie('access_token', access, { ...cookieOpts, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refresh, { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 * 1000 });
    return {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone ?? undefined,
        lineUserId: user.lineUserId ?? undefined,
        role: user.role,
        emailVerified,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    const u = (req as any).user as { id: string };
    const user = await prisma.user.findUnique({ where: { id: u.id } });
    if (!user) {
      return { user: null };
    }
    const emailVerified = Boolean((user as any).emailVerifiedAt);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        lineUserId: user.lineUserId,
        emailVerified,
      },
    };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('update-profile')
  async updateProfile(@Req() req: Request, @Body() body: { name?: string | null; phone?: string | null; lineUserId?: string | null }) {
    const u = (req as any).user as { id: string };
    let nextLineUserId: string | null = null;
    if (typeof body.lineUserId === 'string') {
      const trimmed = body.lineUserId.trim();
      if (trimmed) {
  if (!/^[A-Za-z0-9_-]{3,128}$/.test(trimmed)) {
          throw new BadRequestException('Invalid LINE identifier');
        }
        nextLineUserId = trimmed;
      }
    } else if (body.lineUserId === null) {
      nextLineUserId = null;
    }

    const updated = await prisma.user.update({ where: { id: u.id }, data: { name: body.name ?? null, phone: body.phone ?? null, lineUserId: typeof body.lineUserId === 'undefined' ? undefined : nextLineUserId } });
    const emailVerified = Boolean((updated as any).emailVerifiedAt);
    return {
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name ?? undefined,
        phone: updated.phone ?? undefined,
        lineUserId: updated.lineUserId ?? undefined,
        role: updated.role,
        emailVerified,
      },
    };
  }

  // Provide CSRF token for clients (reads from csurf middleware)
  @Get('csrf')
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req as any).csrfToken?.() as string | undefined;
    if (token) {
      const options: CookieOptions = {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      };
      const cookieDomain = resolveCookieDomain(req);
      if (cookieDomain) {
        options.domain = cookieDomain;
      }
      res.cookie('XSRF-TOKEN', token, options);
    }
    return { csrfToken: token };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const r = req.cookies?.refresh_token as string | undefined;
    if (!r) return { ok: false };
    const rotated = await auth.verifyAndRotateRefreshToken(r);
    if (!rotated) {
      // Clear potentially compromised tokens
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/' });
      return { ok: false };
    }
    res.cookie('access_token', rotated.access, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', rotated.refresh, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { ok: true };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string; channel?: string }) {
    const email = (body.email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    if (!email || !emailRegex.test(email)) {
      throw new BadRequestException('Valid email required');
    }

    const rawChannelValue = typeof body.channel === 'string' && body.channel ? body.channel : 'email';
    const normalizedChannel = rawChannelValue.trim().toLowerCase();
    const allowedChannels: ResetDeliveryChannel[] = ['email', 'whatsapp', 'line'];
    if (!allowedChannels.includes(normalizedChannel as ResetDeliveryChannel)) {
      throw new BadRequestException('Unsupported delivery channel');
    }
    const channel = normalizedChannel as ResetDeliveryChannel;

    const ttlMs = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MS || 1000 * 60 * 30);
    const expiresInMinutes = Math.max(1, Math.round(ttlMs / 60000));
    const maskedEmail = maskEmail(email);
    let rawToken: string | null = null;
    const isProduction = process.env.NODE_ENV === 'production';

    const hintFor = (method: ResetDeliveryChannel) => {
      if (method === 'email') {
        return `We'll email ${maskedEmail || 'your address'} with reset instructions.`;
      }
      if (method === 'whatsapp') {
        return DELIVERY_HINTS.whatsapp;
      }
      return DELIVERY_HINTS.line;
    };

    const emailDelivery: ResetDeliveryAttempt = {
      method: 'email',
      status: 'unknown',
      hint: hintFor('email'),
      target: maskedEmail,
    };

    const altDelivery: ResetDeliveryAttempt | null =
      channel === 'email'
        ? null
        : {
            method: channel,
            status: 'unknown',
            hint: hintFor(channel),
            target: channel === 'whatsapp' ? 'your registered WhatsApp number' : 'your registered LINE chat',
          };

    const deliveries: ResetDeliveryAttempt[] = [];
    const user = await prisma.user
      .findUnique({ where: { email }, select: { id: true, email: true, name: true, phone: true, lineUserId: true } })
      .catch(() => null);
    if (user) {
      const { token } = await auth.generatePasswordResetToken(user.id);
      rawToken = token;
      const baseUrl = (process.env.WEB_APP_BASE_URL || process.env.APP_BASE_URL || process.env.PUBLIC_WEB_URL || 'http://localhost:5173').replace(/\/$/, '');
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;
      const subject = 'Reset your Epic Pizza & Pasta password';
      const plain = `Hi ${user.name ?? 'there'},\n\nWe received a request to reset your Epic Pizza & Pasta password.\n\nClick the link below to choose a new password:\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email. The link expires in ${expiresInMinutes} minutes.\n\nStay saucy,\nEpic Pizza & Pasta`;
      const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0f172a;">
        <h2 style="margin-bottom:16px;">Reset your Epic Pizza & Pasta password</h2>
        <p style="margin:0 0 16px;">Hi ${user.name ? `${user.name},` : 'there,'}</p>
        <p style="margin:0 0 16px;">We received a request to reset your password. Click the button below to choose a new one.</p>
        <p style="margin:24px 0;"><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#ef4444;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Reset password</a></p>
        <p style="margin:0 0 16px;">If the button doesn’t work, copy and paste this link into your browser:<br /><a href="${resetUrl}" style="color:#ef4444;">${resetUrl}</a></p>
        <p style="margin:0 0 16px;">This link expires in ${expiresInMinutes} minutes.</p>
        <p style="margin:32px 0 0;">If you didn’t request this, you can safely ignore this email.</p>
        <p style="margin:16px 0 0;color:#475569;">Stay saucy,<br/>Epic Pizza & Pasta</p>
      </body></html>`;
      const configuredTimeout = Number(process.env.PASSWORD_RESET_EMAIL_TIMEOUT_MS || process.env.EMAIL_SEND_TIMEOUT_MS || 0);
      const sendTimeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 4500;
      const emailSendTask = sendEmail({ to: email, subject, text: plain, html });
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<{ status: 'timeout' }>((resolve) => {
        timeoutHandle = setTimeout(() => resolve({ status: 'timeout' }), sendTimeoutMs);
      });
      const outcome = await Promise.race([
        emailSendTask.then(
          () => ({ status: 'sent' as const }),
          (err: any) => ({ status: 'error' as const, error: err })
        ),
        timeoutPromise,
      ]);
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      if (outcome.status === 'sent') {
        emailDelivery.status = 'queued';
      } else if (outcome.status === 'error') {
        emailDelivery.status = 'error';
        if (!isProduction) {
          emailDelivery.devNote = outcome.error?.message || String(outcome.error);
        }
        // eslint-disable-next-line no-console
        console.error('[auth] failed to send reset email', outcome.error?.message || outcome.error);
      } else {
        emailDelivery.status = 'queued';
        if (!isProduction) {
          emailDelivery.devNote = `Email delivery pending beyond ${sendTimeoutMs}ms; continuing in background.`;
        }
        emailSendTask.catch((err: any) => {
          // eslint-disable-next-line no-console
          console.error('[auth] failed to send reset email after timeout', err?.message || err);
        });
      }

      const altBody = [
        'We received a password reset request for your Epic Pizza & Pasta account.',
        '',
        `Reset link: ${resetUrl}`,
        `Token: ${token}`,
        '',
        `This link expires in ${expiresInMinutes} minutes. If you didn't request this, you can ignore it.`,
      ].join('\n');

      if (altDelivery && channel === 'whatsapp') {
        if (user.phone) {
          if (!isProduction) {
            altDelivery.target = maskPhone(user.phone);
          }
          const result = await sendWhatsAppMessage({ to: user.phone, body: altBody });
          if (result.ok) {
            altDelivery.status = 'queued';
          } else {
            const errorText = result.error || 'WhatsApp delivery failed';
            const lower = errorText.toLowerCase();
            altDelivery.status = lower.includes('not configured') ? 'unavailable' : 'error';
            if (!isProduction) {
              altDelivery.devNote = errorText;
            }
            if (!lower.includes('not configured')) {
              // eslint-disable-next-line no-console
              console.error('[auth] failed to send WhatsApp reset message', errorText);
            }
          }
        } else {
          altDelivery.status = 'unavailable';
          if (!isProduction) {
            altDelivery.devNote = 'No phone number on file for WhatsApp delivery';
          }
        }
      } else if (altDelivery && channel === 'line') {
        if (user.lineUserId) {
          if (!isProduction) {
            altDelivery.target = maskLineId(user.lineUserId);
          }
          const result = await sendLineMessage({ to: user.lineUserId, body: altBody });
          if (result.ok) {
            altDelivery.status = 'queued';
          } else {
            const errorText = result.error || 'LINE delivery failed';
            const lower = errorText.toLowerCase();
            altDelivery.status = lower.includes('not configured') ? 'unavailable' : 'error';
            if (!isProduction) {
              altDelivery.devNote = errorText;
            }
            if (!lower.includes('not configured')) {
              // eslint-disable-next-line no-console
              console.error('[auth] failed to send LINE reset message', errorText);
            }
          }
        } else {
          altDelivery.status = 'unavailable';
          if (!isProduction) {
            altDelivery.devNote = 'No LINE user ID on file for delivery';
          }
        }
      }

      if (!isProduction) {
        // eslint-disable-next-line no-console
        console.info(`[auth] password reset URL for ${email}: ${resetUrl}`);
      }
    } else {
      // Mitigate timing attacks by delaying response slightly when user not found
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    if (channel === 'email' || !altDelivery) {
      deliveries.push(emailDelivery);
    } else {
      deliveries.push(altDelivery);
      deliveries.push(emailDelivery);
    }

    const response: Record<string, any> = {
      ok: true,
      email: maskedEmail,
      expiresInMinutes,
      delivery: {
        primary: channel,
        attempts: deliveries,
      },
    };
    const anyQueued = deliveries.some((attempt) => attempt.status === 'queued');
    if (rawToken && !anyQueued) {
      response.resetToken = rawToken;
    }
    if (!isProduction && rawToken) {
      response.devToken = rawToken;
    }
    return response;
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; password: string }) {
    const token = (body.token || '').trim();
    if (!token) {
      throw new BadRequestException('Reset token required');
    }
    const password = body.password || '';
    validatePasswordPolicy(password);

    const tokenRecord = await auth.findValidPasswordResetToken(token);
    if (!tokenRecord) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await argon2.hash(password);
    await auth.consumePasswordResetToken({ id: tokenRecord.id, userId: tokenRecord.userId, tokenHash: tokenRecord.tokenHash }, passwordHash);

    return { ok: true };
  }
}
