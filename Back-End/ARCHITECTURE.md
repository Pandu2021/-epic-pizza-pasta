# Back-End Architecture

Last updated: 2025-09-19

## Overview
NestJS (Express) application with layered modules and Prisma ORM.

- Security middleware: helmet, hpp, cors allowlist, morgan + pino-http, rate limit, CSRF
- Validation: global ValidationPipe (whitelist, transform, forbidNonWhitelisted)
- Auth: JWT (RS256) via HttpOnly cookies; access/refresh tokens
- Data: PostgreSQL via Prisma
- Payments: PromptPay QR + webhook verification

## Modules
- auth: login/register/refresh/logout, CSRF token route
- menu: public menu endpoints; admin menu management
- orders: create/read orders; admin order management
- payments: PromptPay integration (create QR, check status)
- contact: simple contact form endpoint
- estimate: distance/fee estimation stub
- health: `/api/health`
- admin: controllers for users, orders, menu (behind admin guard)

## Middleware / Filters
- Helmet, HPP, body limits
- Request ID injection + pino-http logger
- Global rate limiter + stricter per-auth endpoints
- CSRF protection with double-submit cookie
- Minimal error handler to avoid leaking stack traces in prod

## Persistence (Prisma)
- Models: User, MenuItem, Order, OrderItem, Payment, WebhookEvent
- Migrations in `prisma/migrations`
- Seed script in `prisma/seed/menu.seed.ts`

## Configuration
- `PORT`, `CORS_ORIGINS`, `COOKIE_SECRET`, `BODY_LIMIT`, `HELMET_CSP`
- JWT keys/TTLs, database URL, PromptPay secrets

## Logging
- pino-http attaches `req.id` and outputs structured logs
- morgan provides combined access logs

## Future improvements
- Refresh token rotation + revocation store
- Centralized audit log persisted to DB
- OpenAPI/Swagger generation and typed client
