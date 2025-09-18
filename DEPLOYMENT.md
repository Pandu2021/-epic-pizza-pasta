## Deployment guide: Render.com (Node.js backend + SPA frontend)

Dokumen ini menjelaskan cara deploy Epic Pizza & Pasta ke Render.com:
- Backend: NestJS Web Service (Node.js)
- Frontend: React + Vite Static Site

File blueprint: `render.yaml` sudah disertakan agar mudah deploy otomatis via Render.

### Prasyarat
- Akun Render.com
- Database PostgreSQL (Render PostgreSQL atau provider lain). Catat connection string untuk `DATABASE_URL`.

### Environment Variables (minimal)
Back-End (Web Service):
- NODE_ENV=production
- DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?schema=public
- COOKIE_SECRET=string-acak-aman
- JWT_PRIVATE_KEY, JWT_PUBLIC_KEY (generate lokal via `Back-End/scripts/generate-jwt-keys.js` dan paste ke Render)
- CORS_ORIGINS=https://<frontend-domain-render>

Front-End (Static Site):
- VITE_API_BASE_URL=https://<backend-domain-render>/api
- VITE_APP_NAME=Epic Pizza & Pasta

### Langkah 1 — Verifikasi build lokal (opsional, direkomendasikan)
1. Backend: `npm ci` lalu `npm run build` di folder `Back-End`
2. Frontend: `npm ci` lalu `npm run build` di folder `Front-End`

### Opsi A — Deploy dengan render.yaml (Blueprint)
1. Push repo ke Git provider (GitHub/GitLab) yang terhubung dengan Render.
2. Di Render, pilih New → Blueprint → Hubungkan repo yang berisi `render.yaml`.
3. Render akan membuat:
   - Web Service: epic-pizza-backend
     - Build: `NPM_CONFIG_PRODUCTION=false HUSKY=0 npm ci && npm run build`
     - Start: `npm run start:prod`
     - Health Check: `/api/health`
     - Post Deploy: `npm run prisma:deploy` (menjalankan migrasi)
   - Static Site: epic-pizza-frontend
     - Build: `NPM_CONFIG_PRODUCTION=false npm ci && npm run build`
     - Publish dir: `dist`
     - Rewrites: `/* -> /index.html`
4. Set semua Environment Variables pada kedua service sesuai kebutuhan.

Catatan:
- `NPM_CONFIG_PRODUCTION=false` memastikan devDependencies (TypeScript, @types) ikut ter-install saat build.
- `HUSKY=0` menonaktifkan git hooks saat build di server.

### Opsi B — Deploy TANPA Blueprint (dua service terpisah)
Jika tidak ingin menggunakan Blueprint, Anda bisa membuat dua service secara manual di Render:
- Back-End (Web Service):
  - Root Directory: `Back-End`
  - Build Command: `NPM_CONFIG_PRODUCTION=false HUSKY=0 npm ci && npm run build`
  - Start Command: `npm run start:prod`
  - Health Check Path: `/api/health`
  - Post-deploy Command: `npm run prisma:deploy`
- Front-End (Static Site):
  - Root Directory: `Front-End`
  - Build Command: `NPM_CONFIG_PRODUCTION=false npm ci && npm run build`
  - Publish Directory: `dist`
  - Redirects/Rewrites: `/* -> /index.html`

Untuk auto-deploy dari GitHub Actions, aktifkan Deploy Hooks di masing-masing service dan isi secrets `RENDER_BACKEND_HOOK_URL` dan `RENDER_FRONTEND_HOOK_URL` seperti dijelaskan di bawah.

### Routing & CORS
- Set `VITE_API_BASE_URL` pada Front-End menunjuk ke domain backend Render (misal `https://epic-pizza-backend.onrender.com/api`).
- Pastikan `CORS_ORIGINS` di backend mencantumkan origin frontend Render (misal `https://epic-pizza-frontend.onrender.com`).

### SSL/HTTPS
- Render menyediakan HTTPS otomatis. Backend sudah `trust proxy` sehingga cookie secure & protocol terdeteksi benar.

### Logs & Health
- Render menyediakan logs. Endpoint kesehatan: `GET /api/health`.

### Common pitfalls
- Gagal migrasi Prisma: pastikan `DATABASE_URL` benar dan `postDeploy` berjalan. Anda juga bisa menjalankan manual `npm run prisma:deploy` via shell Render.
- Mismatch Prisma Client: `npm run prisma:generate` dijalankan sebelum build di script.
- CORS: pastikan origin sesuai (tidak ada trailing slash, gunakan https).

### Update aplikasi
- Render auto-deploy setiap push (autoDeploy: true). Anda bisa mematikan jika ingin manual.

## CI/CD GitHub Actions → Render

Repo ini memiliki workflow CI di `.github/workflows/ci.yml`:
- Backend job: install, prisma generate, lint, build, test
- Frontend job: install, typecheck, lint, build, test
- Deploy job: berjalan pada push ke branch `main` setelah kedua job di atas sukses. Deploy job akan memicu Render Deploy Hooks.

Setup yang diperlukan:
1. Di Render, buka masing-masing service (backend/frontend) → Settings → Deploy Hooks → salin URL deploy hook.
2. Di GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
  - `RENDER_BACKEND_HOOK_URL` = URL deploy hook backend
  - `RENDER_FRONTEND_HOOK_URL` = URL deploy hook frontend
3. Setiap push ke `main` akan:
  - Menjalankan CI (build/lint/test FE & BE)
  - Jika sukses, memanggil kedua deploy hooks sehingga Render melakukan deploy.

Catatan:
- Jika salah satu secret tidak di-set, langkah deploy untuk service tersebut akan dilewati (workflow tetap sukses).
- Anda tetap dapat menggunakan Render Blueprint (`render.yaml`) untuk membuat service; hooks hanya memicu redeploy dari branch yang sama.
 - Hapus workflow duplikat di `Back-End/.github/workflows/ci.yml` atau jadikan reusable (sudah diubah menjadi reusable) agar tidak terjadi double-run.

