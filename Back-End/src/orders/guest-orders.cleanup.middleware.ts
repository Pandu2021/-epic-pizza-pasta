import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { GuestOrdersService } from './guest-orders.service';

@Injectable()
export class GuestOrdersCleanupMiddleware implements NestMiddleware {
  constructor(private readonly guestOrders: GuestOrdersService) {}

  use(_req: Request, _res: Response, next: NextFunction) {
    this.guestOrders.cleanupExpiredSessions();
    next();
  }
}
