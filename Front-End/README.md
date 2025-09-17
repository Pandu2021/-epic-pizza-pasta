# Epic Pizza & Pasta — Frontend (React + Vite + TS)

## Quick start

- Install dependencies
- Run dev server
- Build and preview

## Scripts
- dev: start Vite dev server
- build: typecheck then build
- preview: preview built assets
- test: run unit tests (Vitest)
- lint: run ESLint

## Env vars
Create `.env` with:
- VITE_API_BASE_URL=http://localhost:3000/api
- VITE_APP_NAME=Epic Pizza & Pasta

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

---
This scaffold aligns with the project summary and can be wired to backend endpoints when ready.

Deployment
- For Render.com deployment (Static Site with SPA routing), see the root `DEPLOYMENT.md` and `render.yaml`.
