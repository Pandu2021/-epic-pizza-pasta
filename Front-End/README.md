# Epic Pizza & Pasta — Front-End (React + Vite + TS)

Last updated: 2025-09-19

## Table of Contents

- Quick start
- Scripts
- Environment
- Architecture
- API client & CSRF
- Structure
- Security headers & SPA routing
- Testing

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

## Environment
Create `.env` with at minimum:
- VITE_API_BASE_URL=http://localhost:4000/api
- VITE_APP_NAME=Epic Pizza & Pasta

Optional (for precise Contact page map pin):
- VITE_MAP_LAT=13.8732674
- VITE_MAP_LNG=100.4807412

## Architecture
- Stack: React 18, TypeScript, Vite, Tailwind
- Routing: Home, Menu, Product, Cart, Checkout, Profile, Orders, Auth, NotFound
- State/data: TanStack Query + Zustand; i18n: react-i18next (EN/TH)

## API client & CSRF
- Axios instance in `src/services/api.ts` uses:
  - `withCredentials: true` for cookie-based auth
  - CSRF: `xsrfCookieName: 'XSRF-TOKEN'` and header `X-CSRF-Token`
- On app start, it best-effort calls `GET /auth/csrf` to set the token cookie and auto-retries once on CSRF failure.

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
Testing
- Tooling: Vitest + Testing Library + jsdom
- Commands: `npm run test`, `npm run test:ui`
- Suggested: components (ProductCard/CartDrawer), cart store, i18n labels, axios mocks with CSRF header

Documentation consolidation: Former files (SETUP/ARCHITECTURE/TESTING/DOCUMENTATION/SUMMARY/CHECKLIST/DESIGN) have been merged into this README.

Changelog
- 2025-09: CSRF handshake documented, default API base set to port 4000, `.htaccess` security notes.

## Favicon / Tab Icon

Favicon sekarang menggunakan logo perusahaan (PNG) di `public/`:

```html
<link rel="icon" type="image/png" sizes="512x512" href="/favicon.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/favicon-180.png" />
```

Masih ada `favicon.svg` sebagai fallback sementara; bisa dihapus setelah semua varian PNG tersedia & deploy sukses.

Mengapa sebelumnya muncul di localhost namun tidak di https://epicfoodorders.com/?

Kemungkinan penyebab:
1. Cache browser: Browser menyimpan favicon lama untuk origin localhost.
2. File lokal belum di-commit: Mungkin dulu ada `favicon.ico` sementara di folder lokal yang tidak masuk git.
3. Path salah: Referensi ke `/src/assets/...` tidak otomatis menjadi root file di build output kecuali ditempatkan di `public/`.

Perbaikan yang dilakukan (evolusi):
1. Tahap awal: tambah `favicon.svg` sebagai placeholder.
2. Tahap sekarang: gunakan logo perusahaan (dibuat beberapa ukuran PNG) + referensi di `index.html`.
3. Referensi ke `/src/assets/...` dihapus karena tidak cocok untuk favicon build output.

Cara verifikasi setelah deploy:
1. Deploy front-end.
2. Buka https://epicfoodorders.com/favicon.svg langsung (cek status 200 dan tampil SVG).
3. Hard refresh (Ctrl+F5 / Cmd+Shift+R).
4. Jika belum muncul: buka DevTools > Application > Clear storage > Clear site data, reload.

Menambah dukungan Apple Touch & PWA (opsional):
1. Export PNG 180x180 dan 512x512 dari logo.
2. Simpan di `public/` sebagai `favicon-180.png`, `favicon-512.png`.
3. Tambahkan di `index.html`:
  ```html
  <link rel="apple-touch-icon" sizes="180x180" href="/favicon-180.png" />
  <link rel="icon" type="image/png" sizes="512x512" href="/favicon-512.png" />
  ```
4. (Opsional) Tambahkan `site.webmanifest` untuk PWA.

Cache busting ketika mengubah favicon:
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=2" />
```
Naikkan angka versi (`v=3`, dst) bila update desain agar browser paksa reload.

