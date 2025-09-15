import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import csrf from 'csurf';
import { ValidationPipe } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // When running behind cPanel/Apache (Passenger) or any reverse proxy
  // ensure Express trusts proxy headers for correct protocol/IP handling
  (app as any).set('trust proxy', 1);

  app.use(helmet({
    // Disable strict CSP by default; consider enabling with allowlist if front-end domains are known
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cookieParser(process.env.COOKIE_SECRET));
  app.use(morgan('combined'));

  // Basic rate limit (adjust per route as needed)
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.enableCors({
    origin: (origin, cb) => {
      const allow = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim());
      if (!origin || allow.includes(origin)) cb(null, true);
      else cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));

  // CSRF Protection using double-submit cookie pattern
  // Use a separate secret cookie for CSRF (do NOT name it the same as the token cookie)
  const csrfProtection = csrf({
    cookie: {
      key: 'csrf_secret', // secret stored here (httpOnly not required for csurf)
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    },
    // Client sends the token via header, generated from secret; FE reads token from XSRF-TOKEN cookie set by /api/auth/csrf
    value: (req: any) => (req.headers['x-csrf-token'] as string) || req.body?.csrfToken,
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  });
  // Apply CSRF protection to all routes except selected auth endpoints
  app.use((req: Request, res: Response, next: NextFunction) => {
  const skip = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/forgot-password',
    ];
    if (skip.includes(req.path)) return next();
    return (csrfProtection as any)(req, res, next);
  });

  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();
