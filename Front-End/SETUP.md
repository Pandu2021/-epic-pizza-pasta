# Front-End Setup (Vite + React + TS)

Last updated: 2025-09-19

## Requirements
- Node.js 18+
- npm 9+

## Environment
Create `.env` with:
```
VITE_API_BASE_URL=http://localhost:4000/api
VITE_APP_NAME=Epic Pizza & Pasta
```

## Install & run
```
npm ci
npm run dev
```

- App: http://localhost:5173
- Build: `npm run build`
- Preview: `npm run preview`

## Notes
- Ensure backend is running on port 4000 (or update `VITE_API_BASE_URL`).
- SPA routing and security headers are configured via `public/.htaccess` for Apache hosting. Adjust CSP `connect-src` for API origin.
