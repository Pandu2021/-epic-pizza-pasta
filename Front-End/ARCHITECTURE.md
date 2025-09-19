# Front-End Architecture

Last updated: 2025-09-19

## Stack
- React 18, TypeScript, Vite
- Tailwind CSS
- React Router, TanStack Query, Zustand
- i18next for EN/TH

## Structure
- src/pages: route pages
- src/components: presentational and interactive components
- src/store: Zustand stores (cart, user, etc.)
- src/services: API client(s)
- src/i18n: translation setup and resources
- src/utils: helpers
- src/styles: global CSS

## Networking
- Axios instance configured with `withCredentials: true`
- CSRF handshake via `GET /auth/csrf` to set token cookie
- Error boundary component captures render errors

## Security
- `.htaccess` adds CSP, HSTS, and common headers when hosted on Apache
- Avoid `dangerouslySetInnerHTML`; sanitize any dynamic HTML (none by default)

## Future improvements
- Route-based code splitting
- Preload critical fonts/assets
- Generate OpenAPI client to reduce manual typings
