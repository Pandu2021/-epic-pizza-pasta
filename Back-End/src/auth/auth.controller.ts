import { Body, Controller, Get, Post, Req, Res, UseGuards, ConflictException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { prisma } from '../prisma';
import * as argon2 from 'argon2';
import { Response, Request } from 'express';
import { auth } from './auth.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';

@Controller('api/auth')
export class AuthController {
  @Post('register')
  async register(@Body() body: { email: string; password: string; name?: string; phone?: string }) {
    const email = (body.email || '').trim().toLowerCase();
    if ((body.password || '').length < 8 || !/[A-Za-z]/.test(body.password) || !/\d/.test(body.password)) {
      throw new BadRequestException('Password must be at least 8 characters and include letters and numbers');
    }
    const passwordHash = await argon2.hash(body.password);
    try {
      const user = await prisma.user.create({ data: { email, passwordHash, name: body.name, phone: body.phone } });
      return { id: user.id, email: user.email, name: user.name, phone: user.phone };
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException('Email already in use');
      }
      throw e;
    }
  }

  @Post('login')
    async login(@Body() body: { email: string; password: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
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

      const user = await prisma.user.findUnique({ where: { email } });
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
      // success: reset counter
      store.delete(key);
      (req as any)?.log?.info({ userId: user.id, email, ip }, 'login success');
    const payload = { id: user.id, email: user.email, role: user.role };
    const access = auth.signAccess(payload);
    const refresh = auth.signRefresh(payload);
    const cookieOpts = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };
    res.cookie('access_token', access, { ...cookieOpts, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refresh, { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 * 1000 });
    return { ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    const u = (req as any).user as { id: string };
    const user = await prisma.user.findUnique({ where: { id: u.id }, select: { id: true, email: true, name: true, role: true, phone: true } });
    return { user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('update-profile')
  async updateProfile(@Req() req: Request, @Body() body: { name?: string | null; phone?: string | null }) {
    const u = (req as any).user as { id: string };
    const updated = await prisma.user.update({ where: { id: u.id }, data: { name: body.name ?? null, phone: body.phone ?? null } });
    return { user: { id: updated.id, email: updated.email, name: updated.name ?? undefined, phone: updated.phone ?? undefined, role: updated.role } };
  }

  // Provide CSRF token for clients (reads from csurf middleware)
  @Get('csrf')
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req as any).csrfToken?.() as string | undefined;
    if (token) {
  res.cookie('XSRF-TOKEN', token, {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
    }
    return { csrfToken: token };
  }

  @Post('refresh')
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const r = req.cookies?.refresh_token as string | undefined;
    if (!r) return { ok: false };
    const payload = auth.verify(r);
    if (!payload) return { ok: false };
    const access = auth.signAccess(payload);
    res.cookie('access_token', access, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    return { ok: true };
  }

  // Basic forgot-password stub for development
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    const email = (body.email || '').trim().toLowerCase();
    // Do not reveal whether account exists; log token in dev
    const user = await prisma.user.findUnique({ where: { email } }).catch(() => null);
    if (user) {
      const token = Math.random().toString(36).slice(2);
      // eslint-disable-next-line no-console
      console.log(`[dev] Password reset token for ${email}: ${token}`);
    }
    return { ok: true };
  }
}
