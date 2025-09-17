# Epic Pizza & Pasta — Front-End Documentation

Date: 2025-09-17

## Overview
React + Vite + TypeScript SPA for menu browsing, cart/checkout, profile & order history, with i18n and secure API integration.

## Features
- Pages: Home, Menu, Product, Cart, Checkout, Profile, Orders, Order Confirmation, Login, Register, Forgot, NotFound
- Components: Layout, LanguageSwitcher, CategoryChips, ProductCard, CartDrawer, Carousel, ScrollTopButton
- i18n: react-i18next (EN/TH)
- Data/state: TanStack Query + Zustand
- API client: Axios with `withCredentials` and CSRF integration
- SPA routing via `public/.htaccess` (Apache)

## Security Practices
- `.htaccess`: HTTPS redirect, CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Permissions-Policy
- CSRF flow: auto-fetch `GET /auth/csrf` and send `X-CSRF-Token` for non-GET via axios interceptor
- No use of `dangerouslySetInnerHTML`, `eval`, or direct `innerHTML`
- Token storage via HttpOnly cookies (server managed)

## Environment Variables
Create `Front-End/.env`:
```
VITE_API_BASE_URL=http://localhost:4000/api
```
Add others as needed (e.g., app name, feature flags) with `VITE_` prefix.

## Scripts
- `npm run dev` — start Vite dev server
- `npm run build` — typecheck then build
- `npm run preview` — preview built assets
- `npm run test` — run unit tests (Vitest)
- `npm run lint` — run ESLint

## Structure
- `src/pages` — route pages
- `src/components` — reusable UI
- `src/services/api.ts` — axios client
- `src/store` — Zustand stores
- `src/i18n` — i18next setup and locales
- `src/utils`, `src/styles`

## Routes
- `/`, `/menu`, `/menu/:id`
- `/cart`, `/checkout`
- `/profile`
- `/orders`, `/order-confirmation`
- `/login`, `/register`, `/forgot-password`
- `*` Not Found

## Build/Deploy Notes
- For Apache/cPanel, `public/.htaccess` enables SPA routing and sets security headers
- Adjust CSP `connect-src` to include your API origin (e.g., http://localhost:4000)

## TODO / Next Steps
- Reduce `'unsafe-inline'` in CSP for styles using nonce/hash when feasible
- Add e2e tests for auth/CSRF flows
- Document any additional env flags used by new features
