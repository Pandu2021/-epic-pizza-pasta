import type { Request, Response, NextFunction } from 'express';
import { CaptchaService } from './captcha.service';

type MiddlewareOptions = {
  enforceForMethods?: string[];
};

const DEFAULT_METHODS = ['POST'];

export function createCaptchaMiddleware(service: CaptchaService, options: MiddlewareOptions = {}) {
  const methods = options.enforceForMethods || DEFAULT_METHODS;
  return async (req: Request & { captchaVerified?: boolean }, res: Response, next: NextFunction) => {
    try {
      if (!service.isEnabled()) {
        return next();
      }
      if (!methods.includes(req.method.toUpperCase())) {
        return next();
      }
      if (req.captchaVerified) {
        return next();
      }
      const headerToken = (req.headers['x-captcha-token'] as string | undefined) || undefined;
      const bodyToken = typeof req.body === 'object' && req.body ? (req.body.captchaToken as string | undefined) : undefined;
      const queryToken = typeof req.query.captchaToken === 'string' ? (req.query.captchaToken as string) : undefined;
      const token = headerToken || bodyToken || queryToken;
      const remoteIp = req.headers['cf-connecting-ip'] as string | undefined || req.ip;
      const ok = await service.verify(token, remoteIp || undefined);
      if (!ok) {
        return res.status(400).json({ message: 'Captcha verification failed' });
      }
      req.captchaVerified = true;
      return next();
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || 'Captcha middleware failure' });
    }
  };
}
