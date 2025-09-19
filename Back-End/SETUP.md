# Back-End Setup

Last updated: 2025-09-19

## Requirements
- Node.js 18+
- PostgreSQL 16 (local or remote)
- npm 9+

Optional:
- Docker Desktop (for local Postgres via docker-compose)

## Environment variables
Copy `.env.example` to `.env` and fill values. Minimal set for local dev:

```
PORT=4000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/epic_pizza?schema=public
COOKIE_SECRET=dev-cookie-secret
JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----
CORS_ORIGINS=http://localhost:5173
HELMET_CSP=false
BODY_LIMIT=200kb
```

Generate JWT keys:
- `node scripts/generate-jwt-keys.js` (copy outputs into `.env`)

## Local database with Docker

```
# From Back-End folder
docker compose up -d db
```

This starts Postgres on 127.0.0.1:5432.

## Install, migrate, and seed

```
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run seed:menu
```

## Run

- Dev: `npm run start:dev`
- Build: `npm run build`
- Prod: `npm run start:prod`

API: http://localhost:4000

## Troubleshooting
- Prisma client mismatch: run `npm run prisma:generate`
- Migration errors: verify `DATABASE_URL` and that DB is reachable
- CORS issues: ensure `CORS_ORIGINS` includes frontend origin exactly
