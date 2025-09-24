# Status & Rangkuman Proyek – Epic Pizza & Pasta

Tanggal dokumen: 2025-09-24  
Bahasa: Indonesia  
Scope: Backend (NestJS + Prisma), Frontend (React + Vite), Infrastruktur (Render, GitHub Actions), Keamanan, Kualitas Kode, Roadmap.

---
## 1. Ringkasan Singkat
Aplikasi full‑stack untuk pemesanan pizza & pasta (bilingual EN/TH) dengan pembayaran PromptPay (QR) dan pencatatan order ke Google Sheets. Backend sudah menerapkan fondasi keamanan (JWT RS256, CSRF, rate limiting, login lockout, CORS allowlist, Helmet, HSTS prod). Frontend siap konsumsi API dengan CSRF dan cookie-based auth.

Fokus berikutnya: rotasi & revokasi refresh token, dokumentasi OpenAPI, penguatan observability (metrics, tracing), audit logging, serta peningkatan test coverage & reliability (queue + payment flow). Frontend masih bisa dioptimalkan untuk performa (code splitting, gambar) dan aksesibilitas.

---
## 2. Cakupan Sistem
### Backend
- NestJS modular (auth, menu, orders, payments, contact, estimate, health, admin*)
- Prisma + PostgreSQL (model: User, MenuItem, Order, OrderItem, Payment, WebhookEvent)
- Integrasi PromptPay (generate QR + webhook verifikasi HMAC)
- Integrasi Google Sheets (append / update status via job queue in‑memory)

### Frontend
- React 18 + Vite + TypeScript + Tailwind
- State/data: TanStack Query + Zustand; i18n: react-i18next (EN/TH)
- SPA routing: Home, Menu, Product, Cart, Checkout, Profile, Orders, Auth, NotFound
- Axios client with CSRF & credentials

### Infrastruktur & DevOps
- Render: blueprint `render.yaml` (backend service + static site)
- GitHub Actions CI (lint, build, test — BE & FE) + deploy hooks
- Keep-alive script (mitigasi cold start free tier)

---
## 3. Status Implementasi (High Level)
### 3.1 Sudah Dilakukan (DONE)
Backend:
- Struktur modular NestJS; environment-based config
- Prisma schema + migrasi awal + index kategori menu
- DTO validation global (whitelist + forbidNonWhitelisted + custom error flatten)
- Security middleware: helmet (CSP opsional), hpp, compression, cookie-parser, rate-limit global & khusus auth
- CORS allowlist + dev fallback untuk localhost dinamis
- CSRF protection (double submit cookie) dengan pengecualian webhook & beberapa endpoint auth
- JWT RS256 akses & refresh (belum rotasi) + HttpOnly cookies + SameSite=Lax + Secure (prod)
- Login lockout (5 gagal / 15m per email+IP => 429)
- Logging pino-http (req id) + morgan (redundan, bisa diringkas — lihat rekomendasi)
- PromptPay QR payload builder + webhook (HMAC `PROMPTPAY_WEBHOOK_SECRET`)
- In-memory job queue sederhana (append & update status Google Sheets + retry log di WebhookEvent)
- HSTS otomatis di production
- Body size limit configurable (`BODY_LIMIT`)
- Seed menu & script generate key JWT
- Dockerfile + docker-compose (db + layanan)

Frontend:
- Konfigurasi Vite + Tailwind siap produksi
- Axios client withCredentials + CSRF token handshake otomatis
- i18n EN/TH; struktur komponen modular
- `.htaccess` untuk SPA fallback + security headers (CSP/HSTS/NoSniff/Frame deny)
- Vitest setup

DevOps & Deployment:
- Render blueprint (build & start command sudah adaptif dengan Prisma deploy saat start)
- CI backend & frontend (install, generate, lint, build, test) + optional deploy hooks
- Keep-alive GitHub Actions (interval 14 menit) + dokumentasi removal

### 3.2 Belum Dilakukan / In Progress (Backlog)
(Disusun per kategori; diberikan prioritas P1 (tinggi), P2 (menengah), P3 (nice-to-have))

Keamanan / Auth:
- (P1) Rotasi & revokasi refresh token (token hijacking mitigation)
- (P1) Password reset / forgot password lengkap (endpoint tersirat, implementasi belum terlihat)
- (P2) Audit log DB terstruktur (aksi admin, login sukses/gagal, perubahan status order)
- (P2) Enkripsi data sensitif opsional (misal nomor telepon) / masking log
- (P3) 2FA / OTP login kritikal admin

API & Dokumentasi:
- (P1) OpenAPI/Swagger + typed client generation
- (P2) Versi API (v1 prefix) & changelog otomasi
- (P3) Endpoint metrics (Prometheus) & p99 latency tracking

Observability & Reliability:
- (P1) Metrics (Prometheus/OpenTelemetry) + dashboard dasar (Grafana)
- (P2) Distributed tracing (OTel) untuk chain request → DB / Sheets / webhook
- (P2) Health: readiness probe (DB/connectivity) terpisah dari liveness
- (P2) Queue durable (Redis/BullMQ) menggantikan in-memory untuk tasks Idempotent
- (P3) Alerting (Webhook/Slack) untuk error rate & kegagalan webhookEvents berulang

Data & Schema:
- (P1) Enums di Prisma untuk: User.role, Order.status, Payment.status, Payment.method
- (P1) Index tambahan: Order(userId + createdAt desc), Order(phone + createdAt), Payment(status), WebhookEvent(type + createdAt)
- (P2) Kolom `deletedAt` (soft delete) untuk User/MenuItem (audit & restore)
- (P3) Field normalisasi harga & pajak (versi pricing rules)

Kualitas Kode & Arsitektur:
- (P1) Transaksikan pembuatan order + items + payment (atomic) (saat ini step terpisah)
- (P1) Error handling global konsisten (HttpExceptionFilter custom + mapping error Prisma)
- (P2) Pisahkan konfigurasi security (helmet, rate limit, csrf) ke modul `SecurityModule`
- (P2) Hilangkan redundansi logging (pino + morgan) atau gunakan satu (pino-http) + transport pretty dev
- (P3) Extract domain services (PricingService, PaymentService) untuk memudahkan test

Testing:
- (P1) Integration/E2E: Supertest untuk auth, orders, payments, CSRF
- (P1) Test signature PromptPay webhook (happy / tampered)
- (P2) Property-based test (harga total vs items) / fuzz invalid payload
- (P2) Coverage threshold + badge CI
- (P3) Playwright end-to-end (checkout flow, multi-locale)

Frontend:
- (P1) Code splitting route-level + dynamic import komponen berat (carousel, charts?)
- (P1) Optimisasi gambar (format modern, ukuran responsive) + lazy loading
- (P2) Implementasi skeleton/loading states konsisten + prefetch order history
- (P2) Audit Lighthouse (performance, a11y, best practices) + perbaikan
- (P3) PWA (manifest + offline menu cache + fallback)

Performance / Scaling:
- (P1) Caching query menu (Redis / in-memory LRU) + ETag/If-None-Match
- (P2) Rate limit adaptif per IP (sliding window Redis) & circuit breaker payments
- (P2) Batched logging & log correlation antar layanan
- (P3) Pre-warm SSR / atau edge caching (jika perlu SEO halaman menu)

DevEx:
- (P2) Validasi environment (zod/class-validator) di bootstrap
- (P2) Pre-commit hooks (lint-staged, commitlint conventional)
- (P3) .editorconfig & konsistensi format (prettier configs unified)

Keberlanjutan & Compliance:
- (P2) Dependency scanning (npm audit / Snyk) pipeline fail threshold
- (P2) Secret scanning (gitleaks action) + policy
- (P3) Data retention policy (pembersihan WebhookEvent lama)

---
## 4. Fitur Keamanan yang Sudah Diterapkan
| Kategori | Implementasi | Catatan |
|----------|--------------|---------|
| Transport | HSTS (production), trust proxy | Pastikan HTTPS enforced di proxy depan |
| Headers | Helmet (CSP opsional), referrerPolicy, frameguard, noSniff | Aktifkan CSP di prod dengan nonce/hash |
| Auth | JWT RS256 (access & refresh cookies) | Belum ada rotasi & revocation store |
| Cookies | HttpOnly; SameSite=Lax; Secure (prod) | Pertimbangkan SameSite=Strict utk cookie non-refresh jika UX ok |
| CSRF | Double-submit cookie (`csrf_secret` + `XSRF-TOKEN`) | Skip pada webhook & beberapa endpoint auth |
| Rate Limit | Global 300 / 15m + auth endpoint 30 / 15m | Tambah store ter-distribusi (Redis) untuk scale |
| Login Lockout | 5 gagal / 15 menit per email+IP → 429 | Tambah exponential backoff + reset on success |
| Validation | DTO global whitelist + forbidNonWhitelisted | Sudah aman dari injeksi field liar |
| HPP | `hpp()` mencegah param array duplikat | OK |
| Body Limit | Configurable (`BODY_LIMIT`) | Tambah limit compression bomb (zlib max) |
| CORS | Allowlist + dev fallback regex localhost | Log origin yang ditolak untuk audit |
| Webhook Auth | HMAC `x-signature` PromptPay | Tambah replay protection (timestamp) |
| Logging | pino-http (req id) + morgan | Redundan; hapus salah satu |
| Error Handling | Minimal, stack disembunyikan di prod | Tambah sanitasi pesan Prisma validation |
| Data Integrity | Prisma schema + beberapa index menu | Tambah enum + constraint referential tambahan |
| Secrets | ENV manual | Tambah validasi struktur dan rotasi terjadwal |

---
## 5. Gap & Risiko Keamanan Penting
1. Refresh token tidak dirotasi → risiko token reuse jika bocor.  
2. Tidak ada revocation list / session store (tidak bisa paksa logout target).  
3. Order creation non-transaksional: potensi inkonsistensi (payment row gagal setelah order sukses).  
4. Webhook belum punya replay attack mitigation (timestamp + window).  
5. Logging ganda (pino + morgan) → noise & overhead.  
6. Queue in-memory: kehilangan tugas saat restart (kemungkinan kehilangan pencatatan Sheets).  
7. Tidak ada audit trail persist untuk aksi admin (menyulitkan forensik).  
8. Belum ada OpenAPI → sulit validasi klien dan test contract otomatis.  
9. Tidak ada centralized error normalization (menyulitkan observability).  
10. CSP off by default – di production bisa memperkecil XSS surface.  

---
## 6. Rekomendasi Peningkatan (Detail)
### 6.1 Backend Kode & Arsitektur
- Gunakan Prisma transaction (`prisma.$transaction`) untuk create Order + Items + Payment → atomic.
- Refactor `main.ts` → modul `SecurityModule` & `LoggingModule` untuk isolasi konfigurasi.
- Ganti string literal status/role jadi Prisma `enum` + guard type-safe.
- Tambahkan repository layer tipis atau service domain (Pricing, Payment, OrderLifecycle) agar business logic mudah diuji.
- Centralized error filter (mapping Prisma known errors → 400/409) + logging tanpa stack leak.
- Hilangkan morgan; fokus pino (bisa tambah transport pretty dev).  
- Tambah correlation id ke outbound (webhook / Sheets).  
- Validasi ENV dengan schema (zod) sebelum bootstrap.

### 6.2 Data & Index
- Index kombinasi pencarian user orders: `(userId, createdAt DESC)`.
- Index pencarian by phone: `(phone, createdAt DESC)`.
- Index Payment status untuk polling/monitoring.  
- Enforce enum pada status: Order: received|preparing|on-route|delivered|cancelled. Payment: pending|paid|failed|expired.
- Tambah unique constraint Payment(method, orderId) bila multi metode akan datang.

### 6.3 Keamanan
- Refresh token rotation: simpan hash (bcrypted/argon2id) di table `Session` (userId, tokenHash, expiresAt, ip, userAgent, revokedAt). 
- Revoke path: flush sesi & blacklisting jangka pendek (in‑memory + persist).  
- Aktifkan CSP produksi dengan nonce/hashes; audit inline script.  
- Tambah webhook timestamp header + toleransi (±5 menit) + idempotency (eventId disimpan).  
- Password hashing: gunakan argon2id (jika belum) cost seimbang; tambah pepper ENV opsional.  
- Security scanning di CI: `npm audit --production` + Snyk (opsional) + gitleaks.  
- Implementasi conceal error login (hindari enumerasi email).  
- Rate limit adaptif: IP + credential stuff pattern (redis sliding window).  

### 6.4 Observability & Reliability
- OpenTelemetry (HTTP + Prisma instrumentation) + exporter OTLP → Grafana Tempo/Jaeger.  
- Prometheus metrics (http_request_duration_seconds, prisma_query_seconds bucket) + RED metrics.  
- Durably queue (BullMQ + Redis) untuk tasks Sheets + retry + DLQ log.  
- Health endpoint split: `/health/liveness` (event loop), `/health/readiness` (DB, Redis).  
- Structured log level control (TRACE dev, INFO prod; error budgets).  

### 6.5 Testing
- Tambah `apps/backend/test/e2e/*.spec.ts` (Supertest) covering: Auth (happy, lockout), Orders (DTO invalid, total check), Payment webhook (valid/invalid signature), CSRF 403 mismatch.  
- Contract test: Generate OpenAPI → snapshot tests terhadap definisi schema.  
- Frontend: test store Zustand (cart + edge cases).  
- Integrasi GitHub Actions: coverage threshold (backend >= 70%, naik bertahap).  

### 6.6 Frontend
- Dynamic import untuk route (React.lazy) + suspense boundaries.  
- Preload critical lang file + split vendor chunk.  
- Image optimization (srcset webp/avif) + tailwind `aspect-ratio`.  
- Implement Service Worker untuk offline caching menu (opsional PWA).  
- Lighthouse audit → perbaiki a11y (aria-label, fokus trap di dialog).  
- Gunakan CSP strict + sanitasi HTML (jika konten dinamis ke depan).  

### 6.7 DevOps & Deployment
- Tambah job khusus migrasi (preDeploy) saat upgrade plan, pisahkan dari start.  
- Blue/Green atau canary (Render jika upgrade) untuk seamless deploy.  
- Rotasi kunci JWT terjadwal: simpan jwk set (kid) → header `kid` untuk transisi.  
- Infra secret vault (contoh: Doppler, 1Password Connect) daripada plaintext dashboard.  

### 6.8 Performance
- Cache menu fetch (Redis 60s) + invalidasi saat update admin.  
- HTTP caching: `ETag` + `Cache-Control: public,max-age=30` untuk menu.  
- Prewarming prisma connection (sudah prewarm menu optional) + connection pool tuning.  
- Gunakan `prisma accelerate` atau dataloader pattern jika query n+1 muncul (admin listing).  

### 6.9 Kebersihan & Konsistensi Kode
- Tambah `.editorconfig`.  
- Prettier config shared root + enforce line length.  
- Standard commit (conventional commits) + auto changelog.  

---
## 7. Prioritas 30 / 60 / 90 Hari
### 30 Hari (Stabilisasi & Keamanan Inti)
- Refresh token rotation + revocation (Session table)  
- Transaksi order end-to-end  
- OpenAPI & dasar Supertest E2E  
- Aktifkan CSP di production  
- Index penting (Order userId+createdAt, Payment status)  
- Centralized error filter + hilangkan morgan  

### 60 Hari (Observability & Skalabilitas)
- Metrics + dashboards + alert sederhana  
- Durable job queue (BullMQ)  
- Webhook replay protection & idempotency  
- Audit log aksi admin  
- Redis cache menu + ETag  
- Code splitting frontend + optimisasi gambar  

### 90 Hari (Maturitas & Ekstensi)
- Distributed tracing (OTel)  
- Password reset flow lengkap + 2FA opsional admin  
- Coverage >= 80% critical paths  
- Session jwk set rotasi kunci  
- PWA offline mode menu  
- Playwright e2e + perf budget (LCP, TTI)  

---
## 8. Action Quick Wins (Effort Rendah, Dampak Tinggi)
1. Hapus morgan, gunakan pino-http saja (kurangi overhead & duplikasi).  
2. Aktifkan CSP di prod (`HELMET_CSP=true`) + audit console error.  
3. Tambah index Order(userId, createdAt desc) & Payment(status).  
4. Validasi ENV di bootstrap – fail fast.  
5. Gunakan transaksi Prisma untuk order create.  

---
## 9. Contoh Skema Tambahan (Draft)
### 9.1 Tabel Session (Refresh Token Rotation)
```prisma
model Session {
  id          String   @id @default(uuid())
  userId      String
  tokenHash   String   // hash dari refresh token (argon2/bcrypt)
  userAgent   String?
  ip          String?
  createdAt   DateTime @default(now())
  expiresAt   DateTime
  revokedAt   DateTime?
  User        User     @relation(fields: [userId], references: [id])
  @@index([userId])
  @@index([expiresAt])
}
```

### 9.2 Perubahan Enum (Contoh)
```prisma
enum UserRole { customer admin }
enum OrderStatus { received preparing on_route delivered cancelled }
enum PaymentStatus { pending paid failed expired }
enum PaymentMethod { promptpay cod card }
```

---
## 10. Risiko Jika Dibiarkan (Tanpa Perbaikan Kritis)
| Risiko | Dampak | Mitigasi Direkomendasikan |
|--------|--------|--------------------------|
| Token refresh tidak dirotasi | Pengambilalihan sesi jangka panjang | Session store + rotasi + revocation |
| Order & payment tidak atomic | Inkonsistensi data (ghost order / missing payment) | Prisma transaction (& retry) |
| Queue in-memory | Kehilangan tugas saat restart | Redis/BullMQ + persistence |
| Tidak ada audit log | Sulit investigasi insiden | Tabel audit + structured event | 
| CSP off | XSS meningkat | Aktifkan CSP + nonce |
| Tidak ada replay guard webhook | Fraud / duplikasi event | Timestamp + idempotency key |

---
## 11. Penutup
Dokumen ini dimaksudkan sebagai "single source" status proyek saat ini dan rencana penguatan. Implementasi prioritas P1 akan meningkatkan posture keamanan & konsistensi data secara signifikan. Setelah P1 selesai, fokus beralih ke observability dan reliability untuk kesiapan skala.

Silakan gunakan bagian Prioritas 30/60/90 hari untuk tracking di issue tracker. Jika diperlukan, README root dapat ditambahkan tautan ke file ini.

---
Diperbarui otomatis oleh asisten: 2025-09-24.
