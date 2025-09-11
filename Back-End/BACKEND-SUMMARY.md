# Backend Progress Summary

Date: 2025-08-29

Completed
- Project scaffold (NestJS + Prisma + Postgres) with secure defaults
- Core routes: health, orders (create/get), payments (promptpay create, webhook)
- Prisma schema and client generation
- Dockerfile and docker-compose (db + redis)
- Linting/formatting config
- CI workflow file
- .env and .env.example populated
- API-CONTRACT.md (initial)

Pending / Next
- Auth (JWT, roles) and admin routes
- Menu endpoints and CRUD
- Background jobs (email/print/sheets)
- Rate limiting middleware, request logging to centralized sink
- OpenAPI docs and tests (unit/integration)

How to run (Dev)
- npm ci
- npx prisma generate
- npm run start:dev

Build
- npm run build
- npm start
