# Spesifikasi Halaman Admin (Blueprint)

Dokumen ini adalah blueprint lengkap untuk halaman Admin Pizza & Pasta sebelum implementasi kode. Tujuannya agar seluruh tim memiliki pemahaman yang sama tentang cakupan fitur, alur, batasan, dan kriteria penerimaan (acceptance criteria).

Terkait arsitektur & kontrak API:
- Back-End: lihat `Back-End/ARCHITECTURE.md` dan `Back-End/API-CONTRACT.md`
- Front-End: lihat `Front-End/ARCHITECTURE.md` dan `Front-End/TESTING.md`

## 1. Tujuan & Persona

- Persona utama:
  - Admin Toko: mengelola menu, harga, promosi, stok, cabang.
  - Manajer Operasional: memantau pesanan, SLA, pembayaran, pengiriman, laporan.
  - CS/Staff: verifikasi pembayaran COD/transfer, ubah status pesanan, cetak ulang struk.
- Tujuan:
  - Mempercepat operasional (order-to-serve) dengan visibilitas real-time.
  - Menyederhanakan pengelolaan menu dan promosi.
  - Memberikan kontrol terhadap pembayaran, pengiriman, dan pelaporan.

## 2. Ruang Lingkup (MVP vs Lanjutan)

- MVP:
  - Dashboard ringkas metrik harian.
  - Manajemen Pesanan (CRUD terbatas, ubah status, resi/cetak struk).
  - Manajemen Menu (kategori, item, harga, ketersediaan, varian/opsi).
  - Pembayaran (rekonsiliasi, refund manual, verifikasi COD/transfer, status gateway).
  - Pengguna & Peran (Admin, Staff, Manajer) + audit log dasar.
- Lanjutan (fase berikut):
  - Inventory/Stock, Promo/Kupon, Multi-cabang, Laporan mendalam, SLA Alerts, Printer management lanjutan, Integrasi kurir, Export/Import.

## 3. Navigasi Utama

- Dashboard
- Pesanan
- Menu
- Pembayaran
- Pelanggan (opsional fase 2)
- Laporan (opsional fase 2)
- Pengguna & Peran
- Pengaturan (toko, cabang, printer, integrasi)
- Audit Log

Search global (Ctrl+/) dan quick actions untuk perubahan status pesanan.

## 4. Detail Modul

### 4.1 Dashboard
- KPI kartu: Total pesanan hari ini, Omzet hari ini, Rata-rata nilai order, Pesanan menunggu (Pending/Preparing), Kegagalan pembayaran.
- Grafik: Tren order & omzet 7/30 hari.
- Tabel ringkas: 10 pesanan terakhir + aksi cepat (Lihat, Ubah status, Cetak struk).
- Filter: rentang tanggal, kanal (Web/Phone), cabang.
- Acceptance:
  - Data auto-refresh setiap 30 detik (websocket/polling) tanpa reload halaman.
  - Waktu respon < 1.5s untuk metrik utama pada P95.

### 4.2 Pesanan
- Daftar Pesanan:
  - Kolom: ID, Waktu, Pelanggan, Items ringkas, Total, Metode bayar, Status bayar, Status pesanan, ETA, Cabang, Channel.
  - Filter: status, metode bayar, rentang tanggal, cabang, teks bebas (nama/telepon/ID), channel.
  - Aksi massal: ubah status (Preparing → Ready), cetak struk, export CSV (opsional).
- Detail Pesanan:
  - Info pelanggan & kontak, alamat (jika delivery), catatan.
  - Item & modifier/varian, subtotal, pajak, biaya, diskon, total.
  - Status alur: Pending → Confirmed → Preparing → Ready → Out for Delivery → Completed → Cancelled.
  - ETA estimasi dan aktual; histori status dengan timestamp dan user.
  - Pembayaran: status gateway (Omise/PromptPay/Card), kode auth/charge id, bukti transfer (jika ada), COD verification.
  - Aksi: Ubah status, kirim ulang email/SMS, cetak struk, refund (jika eligible), duplicate order.
- Acceptance:
  - Perubahan status tercatat di audit log + nama pengguna.
  - Cetak struk memicu generator PDF lokal/server (lihat `Back-End/scripts/print-pdf.ts`).

### 4.3 Menu
- Struktur: Kategori → Item → Varian/Opsi → Add-ons.
- Fitur:
  - CRUD kategori & item, harga multi-varian, ketersediaan (isAvailable), waktu ketersediaan (time-based availability), foto, deskripsi multi-bahasa (EN/TH/ID jika relevan, sesuai `Front-End/i18n`).
  - Urutan tampilan (drag & drop), tag populer/promo, allergen/veg/spicy.
  - Bulk update harga/availabilitas.
  - Draf vs Publish dengan preview.
- Acceptance:
  - Validasi harga >= 0 dan konsistensi varian.
  - Perubahan mempengaruhi front-end publik setelah Publish; cache di-bust.

### 4.4 Pembayaran
- Ringkasan transaksi: filter per metode (Card, PromptPay, COD, Transfer), status (succeeded, pending, failed, refunded).
- Rekonsiliasi: cocokkan order vs transaksi gateway; flag mismatch.
- Refund manual: input alasan; rekam ke audit + API ke gateway (jika diizinkan dari backend).
- Bukti pembayaran: unggah/lihat (untuk transfer manual), verifikasi oleh Admin.
- Acceptance:
  - Saat verifikasi, status bayar di order berubah dan tercatat.
  - Tombol Retry untuk pembayaran pending/failed bila gateway mendukung.

### 4.5 Pengguna & Peran
- Role:
  - Admin: semua modul.
  - Manajer: semua kecuali pengaturan sensitif (kunci API, konfigurasi gateway).
  - Staff: Pesanan, Cetak, lihat pembayaran, tidak bisa refund/ubah peran.
- Fitur: CRUD pengguna, reset password, lock/unlock, force logout (revoke refresh token), set peran granular per modul.
- Acceptance:
  - Password policy (min length, kompleksitas), 2FA (opsional fase 2).
  - Semua perubahan peran tercatat di audit log.

### 4.6 Pengaturan
- Toko: nama, alamat, jam operasional, pajak, biaya layanan/delivery, mata uang.
- Printer: daftar printer, test print, default cabang, ukuran kertas.
- Integrasi: Omise/Payment keys, Email (SMTP/API), Google Sheets/Drive, Kurir (opsional), Webhook.
- Cabang: daftar cabang, stok per cabang (fase 2), SLA per cabang.
- Acceptance:
  - Kunci API terenkripsi di backend; hanya sebagian tampil (masked) di UI.

### 4.7 Audit Log
- Simpan aksi: siapa, kapan, apa, objek, nilai sebelum/sesudah (untuk operasi penting).
- Filter per user, modul, rentang tanggal.
- Export CSV (opsional fase 2).

## 5. Alur Pengguna Kunci

- Terima Pesanan Baru:
  1) Notifikasi real-time di Dashboard.
  2) Admin buka detail, verifikasi data.
  3) Set status ke Confirmed/Preparing, ETA otomatis dari beban dapur.
  4) Cetak struk; trigger printer dapur.
- Verifikasi Pembayaran Transfer/COD:
  1) Buka Pembayaran, filter Pending.
  2) Lihat bukti, cocokkan nominal.
  3) Klik Verifikasi → order.updated(statusPaid=paid).
- Update Menu Musiman:
  1) Tambah kategori "Seasonal".
  2) Tambah item + foto + waktu ketersediaan.
  3) Preview, lalu Publish.

## 6. Keamanan & Akses

- Auth JWT + Refresh token (lihat `Back-End/src/auth`), periksa peran di setiap endpoint admin.
- CSRF tidak relevan untuk API JSON (gunakan bearer), tapi protect dari XSS melalui sanitasi input.
- Rate limit endpoint sensitif (login, refund, kunci API), reCAPTCHA opsional untuk login.
- Logging & alert untuk 5xx, percobaan brute force.

## 7. Kinerja & Skalabilitas

- Daftar pesanan paginated + pencarian server-side, index DB sesuai `prisma/migrations/*add_menu_indexes*`.
- Websocket/SSE untuk status order; fallback polling 10–30s.
- Caching read-heavy (menu) + invalidasi pada Publish.

## 8. Aksesibilitas & i18n

- Kontras warna, navigasi keyboard, ARIA di komponen tabel & dialog.
- Dukungan multi-bahasa (mengikuti `Front-End/i18n`), fallback EN.

## 9. Keselarasan Back-End

- Endpoint yang dibutuhkan (contoh ringkas, detail di `Back-End/API-CONTRACT.md`):
  - GET/PUT/PATCH `/admin/orders`, `/admin/orders/:id/status`, `/admin/orders/:id/receipt`.
  - GET/POST `/admin/menu/categories|items|variants` + Publish endpoint.
  - GET/POST `/admin/payments`, `/admin/payments/:id/refund`, `/admin/payments/:id/verify`.
  - GET/POST `/admin/users`, `/admin/roles`, `/admin/sessions/revoke`.
  - GET/POST `/admin/settings`, `/admin/printers/test`, `/admin/integrations`.
  - GET `/admin/audit-logs`.

## 10. Desain UI Ringkas

- Layout 2 kolom: Sidebar (navigasi), Konten (tabel/kartu), Header (search + tindakan cepat).
- Komponen kunci: DataTable dengan kolom dinamis, Drawer/Modal untuk detail, Form terstruktur dengan validasi.
- Notifikasi: toast untuk sukses/error, banner untuk peringatan global.

## 11. Validasi & Error Handling

- Validasi front-end + back-end konsisten (Yup/Zod di FE, class-validator di BE jika ada).
- Pesan error ramah: jelaskan apa salah dan tindakan perbaikan.
- Retry untuk operasi idempoten (status update), blokir aksi ganda.

## 12. Logging, Monitoring, Audit

- Audit untuk operasi: status order, pembayaran, refund, publish menu, peran pengguna, pengaturan.
- Korelasi ID di log back-end (request-id) untuk penelusuran.

## 13. Pengujian & QA

- Unit & integrasi FE: komponen tabel, form, state store.
- E2E skenario: alur order, verifikasi pembayaran, publish menu, cetak struk.
- Data uji: gunakan seed `Back-End/prisma/seed` + skrip `Back-End/scripts/test-*.mjs` dan `test-all.ps1` sebagai referensi.

## 14. Kriteria Penerimaan (Ringkasan)

- Semua modul MVP tersedia dan dapat diakses sesuai peran.
- Perubahan status order tercermin real-time dan tercatat di audit log.
- Menu Publish mempengaruhi FE publik dalam <= 1 menit.
- Verifikasi pembayaran mengubah status bayar dan mengunci total order.
- Waktu muat daftar pesanan < 2s P95 untuk 10k data (dengan pagination & filter).

## 15. Risiko & Mitigasi

- Kegagalan printer: tampilkan pesan & opsi simpan PDF; retry.
- Ketidaksesuaian transaksi: sediakan rekonsiliasi manual + catatan.
- Lonjakan trafik: aktifkan cache & skala DB/worker, kurangi polling.

## 16. Lampiran & Referensi

- Back-End: `Back-End/ARCHITECTURE.md`, `Back-End/API-CONTRACT.md`, `Back-End/TESTING.md`, folder `Back-End/scripts/` (cetak, pembayaran tes, dll.).
- Front-End: `Front-End/ARCHITECTURE.md`, `Front-End/DESIGN-FRONTEND.md`, `Front-End/TESTING.md`.
- DevOps/Deploy: `DEPLOYMENT.md`, `render.yaml`.

---

Catatan: Detail skema data mengikuti Prisma di `Back-End/prisma/schema.prisma`. Endpoint final dan payload harus mengacu pada kontrak API terbaru. Dokumen ini akan menjadi dasar pembuatan komponen FE, API BE, serta test plan E2E.

## 17. Subdomain Admin (Front-End) dan Routing

Tujuan: memisahkan Admin UI dari web publik dalam subdomain khusus, dengan isolasi CORS dan cookie.

- Subdomain yang disarankan:
  - Web publik: `https://epicfoodorders.com`
  - Admin: `https://admin.epicfoodorders.com`
  - API: `https://api.epicfoodorders.com` (sudah di `render.yaml`)

- DNS/Hosting (Render):
  - Tambahkan service baru untuk Admin Front-End (runtime `static`, root `Front-End`).
  - Hubungkan custom domain `admin.epicfoodorders.com` ke service tersebut.

- Konfigurasi ENV FE Admin:
  - `VITE_API_BASE_URL=https://api.epicfoodorders.com/api`
  - `VITE_APP_NAME="Epic Pizza Admin"`
  - `VITE_IS_ADMIN=true` (untuk merender routing/guard admin)

- Konfigurasi ENV BE (CORS + Origins) di `render.yaml`:
  - Tambahkan `https://admin.epicfoodorders.com` ke `CORS_ORIGINS` (pisah dengan koma).
  - Pastikan `BACKEND_PUBLIC_URL=https://api.epicfoodorders.com`.

- Routing FE:
  - Base path admin: `/` pada subdomain admin.
  - Rute inti: `/login`, `/dashboard`, `/orders`, `/orders/:id`, `/menu`, `/payments`, `/users`, `/settings`, `/audit-logs`.
  - Guard: butuh JWT (role=admin). Jika tidak ada, redirect ke `/login`.

## 18. REST API Admin (Detail & Contoh)

Semua endpoint admin berada di bawah prefix: `/api/admin/*` dan dilindungi `JwtAuthGuard` + `RolesGuard('admin')` (lihat `Back-End/src/common/guards`). Berikut endpoint yang SUDAH ada dan RENCANA.

### 18.1 Orders (SUDAH ADA)
- GET `/api/admin/orders`
  - Response: list pesanan + `items`, `payment` (lihat `AdminOrdersController.list`).
- GET `/api/admin/orders/:id`
  - Response: detail order + `items`, `payment`.
- PATCH `/api/admin/orders/:id/status`
  - Body: `{ status: 'received|preparing|ready|delivering|completed|cancelled', driverName? }` (`AdminOrderStatusDto`).
  - Efek: update order; enqueue sinkronisasi Google Sheet jika dikonfigurasi.
- GET `/api/admin/orders/metrics/summary`
  - Response: `{ ts, ordersToday, revenueToday, unpaidOrPendingPayments }`.

### 18.2 Menu (SUDAH ADA)
- GET `/api/admin/menu`
- POST `/api/admin/menu`
  - Body: `AdminMenuCreateDto` (kategori, name, description, images, basePrice, priceL, priceXL, options).
- GET `/api/admin/menu/:id`
- PATCH `/api/admin/menu/:id`
  - Body: `AdminMenuUpdateDto`.
- DELETE `/api/admin/menu/:id`

### 18.3 Users (SUDAH ADA)
- GET `/api/admin/users`
- GET `/api/admin/users/:id`
- POST `/api/admin/users`
  - Body: `AdminCreateUserDto` (email, password, role?, name?, phone?).
- PATCH `/api/admin/users/:id`
  - Body: `AdminUpdateUserDto` (role?, name?, phone?, password?).
- DELETE `/api/admin/users/:id`

### 18.4 Payments (RENCANA)
- GET `/api/admin/payments` — daftar transaksi dengan filter `status`, `method`, `dateRange`.
- GET `/api/admin/payments/:id`
- POST `/api/admin/payments/:id/refund` — refund via gateway; catat alasan.
- POST `/api/admin/payments/:id/verify` — verifikasi transfer/COD; update status bayar.
- GET `/api/admin/payments/reconcile` — ringkas mismatch order vs transaksi.

### 18.5 Settings & Integrations (RENCANA)
- GET `/api/admin/settings` — baca konfigurasi tampak (masked untuk secret).
- PATCH `/api/admin/settings` — update konfigurasi non-sensitif.
- POST `/api/admin/printers/test` — test print.
- GET/POST `/api/admin/integrations/:provider` — status & konfigurasi integrasi (Omise, SMTP, Google Sheets).

### 18.6 Audit Logs (RENCANA)
- GET `/api/admin/audit-logs` — pencarian/filter, pagination.

### 18.7 Auth untuk Admin
- Gunakan endpoint umum: `/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh`, OAuth (`/api/auth/google`, `/api/auth/line`).
- FE Admin harus memeriksa `role==='admin'` dari access token atau endpoint profil `/api/me` (jika ada) sebelum memberikan akses.

### 18.8 Contoh Request (FE Admin)
- Fetch orders (paginated—rencana):
  - GET `https://api.epicfoodorders.com/api/admin/orders?limit=20&cursor=...`
- Ubah status order:
  - PATCH `https://api.epicfoodorders.com/api/admin/orders/ORDER_ID/status`
  - Body JSON: `{ "status": "preparing" }`
- Buat item menu:
  - POST `https://api.epicfoodorders.com/api/admin/menu`
  - Body JSON minimal: `{ "category":"Pizza", "name": {"en":"Hawaiian"}, "basePrice": 199 }`

## 19. Perubahan yang Diperlukan pada Konfigurasi

- `render.yaml` (backend service `epic-pizza-backend`):
  - Update `CORS_ORIGINS` tambahkan `https://admin.epicfoodorders.com`.
- Tambah service baru (opsional) untuk Front-End Admin statis:
  - `name: epic-pizza-admin`
  - ENV mirip FE publik, namun `VITE_IS_ADMIN=true` dan `VITE_APP_NAME=Epic Pizza Admin`.
- Front-End `.env` (dev):
  - Tambahkan `VITE_IS_ADMIN=true` saat running admin via `vite` di port lain, dan set `VITE_API_BASE_URL` ke backend dev.

## 20. Acceptance untuk Subdomain & API Admin

- FE Admin hanya dapat diakses via `https://admin.epicfoodorders.com` dan memerlukan login dengan role admin.
- CORS backend mengizinkan admin subdomain dan web publik; cookie/token bekerja lintas subdomain sesuai konfigurasi.
- Semua operasi admin sensitif tercatat di Audit Log.
- Endpoint rencana ditandai dan akan diimplementasikan bertahap; kontrak akan ditambahkan ke `Back-End/API-CONTRACT.md` sebelum coding.