import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { auth } from '../../auth/auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const bearer = (req.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, '');
    const token = bearer || req.cookies?.access_token;
    const payload = token ? auth.verify(token) : null;
    if (!payload) throw new UnauthorizedException('Invalid or missing token');
    req.user = payload;
    return true;
  }
}
