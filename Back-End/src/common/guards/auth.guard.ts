import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { auth } from '../../auth/auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private writeAuthCookies(res: Response, access: string, refresh: string) {
    const base = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };
    res.cookie('access_token', access, { ...base, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refresh, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res: Response = http.getResponse();
    const bearer = (req.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, '')?.trim();
    const token = bearer || req.cookies?.access_token;
    const payload = token ? auth.verify(token) : null;
    if (payload) {
      req.user = payload;
      return true;
    }
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      try {
        const rotated = await auth.verifyAndRotateRefreshToken(refreshToken);
        if (rotated) {
          this.writeAuthCookies(res, rotated.access, rotated.refresh);
          req.user = { id: rotated.user.id, email: rotated.user.email, role: rotated.user.role };
          return true;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[auth.guard] refresh rotation failed', (err as any)?.message || err);
      }
    }
    throw new UnauthorizedException('Invalid or missing token');
  }
}
