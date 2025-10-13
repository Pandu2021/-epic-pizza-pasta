# API Contract — Epic Pizza & Pasta (Backend)

## Konvensi Umum
- Base URL: `https://api.epicfoodorders.com/api`
- Auth: menggunakan cookie HTTP-only `access_token` (JWT) dan `refresh_token`. Beberapa endpoint juga menerima header Authorization: Bearer <token> bila guard mendukung.
- Format: `application/json` kecuali jika disebutkan (contoh: `receipt.pdf`).
- Uang: nilai dalam THB (integer). Integrasi gateway dapat memakai satuan satang secara internal.
- Error: standar HTTP status + body `{ message: string }` atau `{ ok: false }` sesuai kasus.

## Public / Menu
- GET `/api/menu`
  - Query: `category?=string`
  - Response: daftar item menu (id, category, name, description, images, basePrice, priceL, priceXL, updatedAt)
  - Caching: ETag dan Cache-Control (public, max-age=60)
- GET `/api/menu/:id`
  - Response: detail item menu atau `null` jika tidak ada
- GET `/api/menu/search`
  - Query: `q=string` (wajib), `lang=en|th|id` (opsional, default `en`)
  - Response: array hasil pencarian item menu

## Orders / Checkout
- POST `/api/orders` (JWT required)
  - Request
    ```json
    {
      "customer": {"name":"John","email":"john@example.com","phone":"+66999999999","address":"...","lat":13.7,"lng":100.5},
      "items": [{"id":"menu-id","name":"Pizza Margherita XL","qty":1,"price":369}],
      "delivery": {"type":"delivery","distanceKm":3.2,"fee":39},
      "paymentMethod": "promptpay"
    }
    ```
  - Response
    ```json
    {
      "orderId": "uuid",
      "status": "received",
      "amountTotal": 408,
      "payment": {"type":"promptpay","qrPayload":"PROMPTPAY|...","status":"pending"}
    }
    ```
- Authenticated calls only:
  - GET `/api/orders?phone=+66999999999` — JWT required; only admins or users whose profile phone matches may query
  - GET `/api/orders/:id` — JWT required; returns order with items + payment if caller owns the order or is admin
  - POST `/api/orders/:id/cancel` — JWT required; caller must own order or be admin
  - PATCH `/api/orders/:id/status` & `POST /api/orders/:id/confirm-delivered` — admin role required
  - GET `/api/orders/my` — JWT required; riwayat pesanan milik user
  - GET `/api/orders/:id/eta` — JWT required; estimasi waktu siap/antar
  - POST `/api/orders/:id/print` — JWT required; antrikan cetak struk
  - GET `/api/orders/:id/receipt.pdf` — JWT required; unduh PDF struk
  - POST `/api/orders/:id/email-receipt` — JWT required; kirim struk via email `{ to?: string }`
  - GET `/api/orders/:id/stream` — JWT required; SSE stream pembaruan order

## Payments
- POST `/api/payments/promptpay/create`
  - Request: `{ "orderId": "uuid", "amount": 408 }`
  - Response: `{ "qrPayload": "PROMPTPAY|..." }`
- POST `/api/payments/omise/promptpay`
  - Request: `{ "orderId": "uuid", "amount?": 408, "description?": "..." }`
  - Response: `{ ok: true, orderId, chargeId, status, qrPayload?, qrImageUrl? }`
- GET `/api/payments/:orderId/status`
  - Response: `{ orderId, status: "pending|paid|failed|unpaid|unknown", paidAt? }`
- POST `/api/payments/omise/charge`
  - Request: `{ "orderId":"uuid", "amount": 408, "token": "tok_xxx", "description?": "..." }`
  - Response: `{ ok: boolean, chargeId, status }`

### Webhooks
- POST `/api/webhooks/omise`
  - Body: event payload dari Omise (event id akan diverifikasi ke Omise)
  - Response: `{ ok: true }`
- POST `/api/webhooks/promptpay`
  - Headers: `x-signature: <hmac_sha256_hex(payload)>`
  - Body: `{ "orderId": "uuid", "status": "PAID|FAILED", "providerRefId?": "gw_123" }`
  - Response: `{ ok: true }`

## Auth
- POST `/api/auth/register` — membuat akun, set cookie auth, dan kirim email verifikasi.
- POST `/api/auth/login` — Body: `{ email, password, context?: 'admin' }`; set cookie `access_token` & `refresh_token`. Jika `context==='admin'`, role wajib `admin|manager|staff`.
- GET `/api/auth/me` — JWT required; detail profil saat ini.
- POST `/api/auth/logout` — hapus cookie auth.
- POST `/api/auth/refresh` — rotasi token menggunakan `refresh_token` cookie.
- POST `/api/auth/verify-email` — Body: `{ token }` → `{ ok: true, verifiedAt }`.
- GET `/api/auth/verify-email?token=...` — untuk tampilan konfirmasi melalui tautan email.
- POST `/api/auth/resend-verification` — JWT required; kirim ulang verifikasi jika belum terverifikasi.
- POST `/api/auth/forgot-password` — kirim tautan reset via email/WhatsApp/LINE.
- POST `/api/auth/reset-password` — Body: `{ token, password }` → `{ ok: true }`.
- GET `/api/auth/csrf` — sediakan CSRF token dan set cookie `XSRF-TOKEN` (jika middleware aktif).
- OAuth: `GET /api/auth/google` → redirect; `GET /api/auth/google/callback`
- OAuth LINE: `GET /api/auth/line` → redirect; `GET /api/auth/line/callback`

Notes:
- All money values are integers in THB.
- Webhook signature uses `PROMPTPAY_WEBHOOK_SECRET` with sha256 HMAC.

## Admin (JWT + role: admin)

### Orders (Admin)
- GET `/api/admin/orders` — daftar pesanan (include items, payment)
- GET `/api/admin/orders/:id` — detail pesanan
- PATCH `/api/admin/orders/:id/status` — Body: `{ status: 'received|preparing|ready|delivering|completed|cancelled', driverName? }`
- POST `/api/admin/orders/:id/receipt` — trigger cetak ulang struk (printer lokal)
- GET `/api/admin/orders/metrics/summary` — ringkas metrik harian

### Menu (Admin)
- GET `/api/admin/menu`
- POST `/api/admin/menu` — Body: `AdminMenuCreateDto`
- GET `/api/admin/menu/:id`
- PATCH `/api/admin/menu/:id` — Body: `AdminMenuUpdateDto`
- DELETE `/api/admin/menu/:id`

### Users (Admin)
- GET `/api/admin/users`
- GET `/api/admin/users/:id`
- POST `/api/admin/users` — Body: `AdminCreateUserDto`
- PATCH `/api/admin/users/:id` — Body: `AdminUpdateUserDto`
- DELETE `/api/admin/users/:id`

### Payments / Settings / Audit (Rencana)
- Payments: GET/POST `/api/admin/payments`, `/api/admin/payments/:id/refund`, `/api/admin/payments/:id/verify`, `/api/admin/payments/reconcile`
- Settings: GET/PATCH `/api/admin/settings`, POST `/api/admin/printers/test`, GET/POST `/api/admin/integrations/:provider`
- Audit: GET `/api/admin/audit-logs`
