# Back-End Testing

Last updated: 2025-09-19

## Tooling
- Vitest for unit/integration tests
- Supertest (recommended) for HTTP tests (add as needed)

## Commands
```
npm run test       # run once
npm run test:watch # watch mode
```

## Suggested test areas
- Auth
  - login success/failure and lockout after 5 attempts per email+IP
  - refresh flow and cookie flags (httpOnly, sameSite)
- Orders
  - DTO validation, price calculations, edge cases
- Payments
  - PromptPay QR creation returns payload
  - Webhook signature verification (valid vs invalid HMAC)
- Security
  - CSRF: non-GET without token should 403
  - Rate limit: auth routes hit limits appropriately

## CI
See `.github/workflows/ci.yml` (root) for backend job. Extend with coverage thresholds and security audits in the future.
