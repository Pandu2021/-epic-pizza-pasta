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

### Langkah 2 — Deploy dengan render.yaml
1. Push repo ke Git provider (GitHub/GitLab) yang terhubung dengan Render.
2. Di Render, pilih New → Blueprint → Hubungkan repo yang berisi `render.yaml`.
3. Render akan membuat:
   - Web Service: epic-pizza-backend
     - Build: `npm ci && npm run build`
     - Start: `npm run start:prod`
     - Health Check: `/api/health`
     - Post Deploy: `npm run prisma:deploy` (menjalankan migrasi)
   - Static Site: epic-pizza-frontend
     - Build: `npm ci && npm run build`
     - Publish dir: `dist`
     - Rewrites: `/* -> /index.html`
4. Set semua Environment Variables pada kedua service sesuai kebutuhan.

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

