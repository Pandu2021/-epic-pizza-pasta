import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class SimpleAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    // Dev-only simple guard: require header x-admin: 1
    const flag = req.headers['x-admin'];
    if (flag === '1' || flag === 'true') return true;
    throw new UnauthorizedException('Admin access required (set header x-admin: 1)');
  }
}
