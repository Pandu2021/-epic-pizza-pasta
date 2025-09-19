# Epic Pizza & Pasta – Monorepo

Full-stack ordering platform for a pizza & pasta restaurant.

This repository contains two applications:
- Back-End: NestJS + Prisma + PostgreSQL (API and admin)
- Front-End: React + Vite + Tailwind (SPA)

## Table of Contents

- Quick start (Windows PowerShell)
- Project overview
- Architecture (high level)
- Environments & security
- Features & roadmap
- Deployment
- Structure
- Key docs

## Quick start (Windows PowerShell)

- Back-End (http://localhost:4000)
  1. cd .\Back-End
  2. Copy .env.example → .env and fill values
  3. npm ci
  4. npm run prisma:migrate; npm run seed:menu
  5. npm run start:dev

- Front-End (http://localhost:5173)
  1. cd .\Front-End
  2. Create .env with at least:
     - VITE_API_BASE_URL=http://localhost:4000/api
     - VITE_APP_NAME=Epic Pizza & Pasta
  3. npm ci
  4. npm run dev

## Project overview

Epic Pizza & Pasta is a bilingual (EN/TH) web app for browsing menu items, placing orders, and processing payments. It supports PromptPay QR, distance-based delivery fees, order notifications (email/Sheets), and is designed for deployment behind a reverse proxy.

## Architecture (high level)

- Back-End (NestJS + Prisma + PostgreSQL)
  - Controllers: public (menu, orders, payments, contact, estimate, health), auth, admin
  - Security: Helmet/HSTS, CORS allowlist, HPP, rate limit, CSRF (double-submit), ValidationPipe
  - Auth: JWT (RS256) with HttpOnly cookies (access/refresh)
  - Payments: PromptPay QR + webhook verification
  - Health: GET /api/health

- Front-End (React + Vite + Tailwind)
  - Routing: Home, Menu, Product, Cart, Checkout, Profile, Orders, Auth, NotFound
  - State/Data: TanStack Query + Zustand, react-i18next
  - Security headers for Apache via public/.htaccess (CSP, HSTS, etc.)

## Environments & security

- Backend env (subset): PORT, DATABASE_URL, JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, COOKIE_SECRET, CORS_ORIGINS, HELMET_CSP, BODY_LIMIT, PROMPTPAY_WEBHOOK_SECRET
- Frontend env: VITE_API_BASE_URL, VITE_APP_NAME
- Cookies are HttpOnly; SameSite=Lax; Secure in production
- CSRF: client fetches /api/auth/csrf; sends X-CSRF-Token for non-GET requests

## Features & roadmap

Highlights
- Auth & users; admin guard
- Orders with DTO validation
- PromptPay QR + webhook verification
- Logging: pino-http + morgan

Next improvements
- Refresh token rotation + revocation store
- Swagger/OpenAPI docs & typed client
- Wider audit logging and tests in CI
- FE performance (code splitting, image optimization)

## Deployment

See DEPLOYMENT.md. A Render blueprint is provided in render.yaml.

## Structure

- Back-End/ … NestJS service and Prisma schema
- Front-End/ … React + Vite app
- render.yaml … Render.com blueprint for deploying both services

## Key docs

- DEPLOYMENT.md — how to deploy BE/FE (Render, env, health, CORS)
- Back-End/README.md — setup, architecture, security, testing, scripts
- Back-End/API-CONTRACT.md — endpoint shapes and payloads
- Front-End/README.md — setup, architecture, testing, design/security notes

Last updated: 2025-09-19
