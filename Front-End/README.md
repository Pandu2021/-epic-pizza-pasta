# Epic Pizza & Pasta — Front-End (React + Vite + TS)

## Quick start

1) Create `.env` (see below)
2) Install deps: `npm ci`
3) Start dev: `npm run dev` → http://localhost:5173
4) Build: `npm run build`; Preview: `npm run preview`

## Scripts
- dev: start Vite dev server
- build: typecheck then build
- preview: preview built assets
- test / test:ui: Vitest
- lint, format, typecheck

## Env vars
Create `.env` with at minimum:
- VITE_API_BASE_URL=http://localhost:4000/api
- VITE_APP_NAME=Epic Pizza & Pasta

## API client & CSRF
- Axios instance in `src/services/api.ts` uses:
  - `withCredentials: true` for cookie-based auth
  - CSRF: `xsrfCookieName: 'XSRF-TOKEN'` and header `X-CSRF-Token`
- On app start, it best-effort calls `GET /auth/csrf` to set the token cookie and auto-retries once on CSRF failure.

## Tech
- React 18 + Vite + TypeScript
- Tailwind CSS
- React Router, TanStack Query, Zustand
- react-i18next (EN/TH)
- Vitest + Testing Library

## Structure
- src/pages: route pages
- src/components: reusable UI
- src/store: Zustand stores
- src/services: API client
- src/i18n: translations
- src/utils: helpers
- src/styles: global css

## Security headers and SPA routing
- `public/.htaccess` configures SPA fallback, HTTPS redirect, and security headers:
  - CSP (adjust `connect-src` to include your API origin)
  - HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy no-referrer

---
Docs: See `DOCUMENTATION.md` (this folder) and the root `DOCUMENTATION.md`.

Changelog
- 2025-09: CSRF handshake documented, default API base set to port 4000, `.htaccess` security notes.
