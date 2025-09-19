# Epic Pizza & Pasta — Project Documentation

Last updated: 2025-09-19

## 1) Overview

Epic Pizza & Pasta is a full‑stack web application for browsing menu items, placing orders, and processing payments.

- Back-End: NestJS (Express) + Prisma + PostgreSQL
- Front-End: React + Vite + Tailwind
- CI: GitHub Actions
- Deploy: cPanel/Apache (SPA routing via .htaccess) and others

## 2) Architecture

- Back-End (NestJS)
  - Controllers: public (menu, orders, payments, contact, estimate, health), auth, and admin (users, orders, menu)
  - Auth: JWT (RS256) with access/refresh tokens via HttpOnly cookies
  - Validation: Global ValidationPipe; DTOs for orders and admin endpoints
  - Security middleware: Helmet, HPP, CORS whitelist, rate limiting, CSRF (double-submit cookie)
  - Data: Prisma schema with models (User, MenuItem, Order, OrderItem, Payment, WebhookEvent)
  - Payments: PromptPay QR generation + webhook signature verification

- Front-End (React)
  - Pages: Home, Menu, Product, Cart, Checkout, Profile, Login/Register/Forgot, Orders, Order Confirmation, NotFound
  - Components: Layout, LanguageSwitcher, CategoryChips, ProductCard, CartDrawer, Carousel, ScrollTopButton, etc.
  - i18n: i18next
  - Client: Axios with CSRF integration and withCredentials
  - SPA routing: .htaccess for Apache (fallback to index.html)

## 3) Environments & Configuration

- Root/Front/Back .gitignore are hardened to exclude secrets/artifacts. Prisma migrations are whitelisted.
- Back-End env (examples):
  - PORT, NODE_ENV
  - DATABASE_URL
  - JWT_PRIVATE_KEY, JWT_PUBLIC_KEY
  - JWT_ACCESS_TTL, JWT_REFRESH_TTL
  - COOKIE_SECRET
  - CORS_ORIGINS (comma-separated)
  - PROMPTPAY_MERCHANT_ID, PROMPTPAY_WEBHOOK_SECRET
  - HELMET_CSP (set to `true` to enable Helmet CSP)
- Front-End env (Vite):
  - VITE_API_BASE_URL

Refer to Back-End/.env.example for initial guidance (do not commit secrets).

## 4) Security Posture Snapshot

- Backend: ~87–90% implemented after latest changes
  - Previously 17/23 (74%). Added: Admin DTO validation, login lockout, structured logging + HSTS in production.
- Frontend: 9/10 (90%)
- Overall (approximation): ~26/33 → 79% earlier; improved on backend towards ~87–90%.

See details in the Security section below.

## 5) Implemented Features (Highlights)

- Auth & Users
  - Register/Login/Logout, profile update
  - JWT RS256, HttpOnly cookies, access/refresh flow
  - Login lockout (5 fails in 15 mins per email+IP)
  - Role-based admin guard (Users/Menu/Orders)

- Orders & Menu
  - Create order with DTO validation (public orders)
  - Admin CRUD for users/menu with DTO validation

- Payments
  - PromptPay QR create & status
  - Webhook signature verification (HMAC-SHA256 with timingSafeEqual)

- Security Middleware
  - Helmet (Referrer-Policy, Frameguard; CSP via env)
  - HSTS in production
  - HPP, CORS whitelist, body size limits
  - Rate limiting (global + tighter for auth routes)
  - CSRF protection (double-submit cookie)
  - ValidationPipe (whitelist + forbid non-whitelisted)
  - Logging: pino-http with request id + morgan

- Front-End Security
  - .htaccess: HTTPS redirect, CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Permissions-Policy
  - Axios CSRF integration; no dangerous HTML patterns detected

## 6) Gaps / Next Improvements

- Refresh token rotation + revocation store
- Wider audit logging (admin changes, status transitions) persisted to DB
- CI security gates: npm audit/Snyk; e2e security tests
- Harden CSP further in FE (reduce 'unsafe-inline' for styles when feasible)
- Distributed lockout store (Redis) for multi-instance deployments

## 7) Code Health

- Orphan/unreferenced files previously identified:
  - Back-End: `src/common/guards/simple-admin.guard.ts` (unused), `src/orders/dto/create-order.dto-Pandu_wicaksono.ts` (duplicate)
  - Front-End: deprecated admin pages and a few components (Toast/Skeleton) were unused
- Recommendation: delete or archive remaining orphans to reduce confusion.

## 8) Getting Started

### Back-End
- Requirements: Node 18+, PostgreSQL, Prisma CLI
- Install & Build:
  - npm ci
  - npm run prisma:generate
  - npm run build
- Dev:
  - npm run start:dev (tsx watch)
- Migrate/Seed:
  - npm run prisma:migrate
  - npm run seed:menu

### Front-End
- Requirements: Node 18+
- Install & Run:
  - npm ci
  - npm run dev
- Build:
  - npm run build

## 9) Deployment

- Back-End: Build dist, configure env, run with Node (behind reverse proxy). Ensure HTTPS and CORS origins configured.
- Front-End: Static build via Vite; `.htaccess` ensures SPA routing and security headers on Apache. Update CSP connect-src for API origin.

## 10) API Contract & Docs

- See `Back-End/API-CONTRACT.md` for endpoint shapes and expected behaviors.
- Health endpoint: `/api/health`
- Auth endpoints: `/api/auth/*`
- Orders: `/api/orders` etc.

## 11) Testing & CI

- Unit tests via Vitest (backend/frontend)
- CI workflow builds, lints, and tests backend. Extend to `npm audit` and frontend tasks as next steps.

## 12) Changelog (Security Enhancements)

- Added DTO validation for Admin endpoints
- Added login lockout logic (per email+IP)
- Added pino-http structured logging + request id
- Enabled HSTS in production
- Hardened .gitignore (root, back, front) and untracked sensitive files

---

For questions or contributions, see repository README files per package:
- Back-End/README.md
- Front-End/README.md
