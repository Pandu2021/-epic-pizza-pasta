# Back-End Checklist — Epic Pizza & Pasta

This checklist covers backend services, APIs, integrations, and deployment readiness.

## Core API & Data
- [ ] Design database schema for orders, menu items, modifiers, and users.
- [ ] Implement REST/GraphQL endpoints: getMenu, createOrder, getOrder, updateOrderStatus.
- [ ] Validate inputs and implement server-side sanitization.

## Payments & Webhooks
- [ ] Implement PromptPay QR generation and payment confirmation flow.
- [ ] Implement card gateway integration (Omise) and webhook handling (if used).
- [ ] Secure webhook endpoints and verify signatures.

## Integrations
- [ ] Google Maps: distance calculation using Distance Matrix / Directions API.
- [ ] Gmail: configure Gmail API or SMTP to send order notification emails.
- [ ] Google Sheets: implement service-account append rows to spreadsheet.
- [ ] Xprinter: implement print job sender or provide print-proxy API for local agent.

## Security & Config
- [ ] Centralize secrets in `.env` and do not commit them.
- [ ] Implement CORS policy and rate limiting on API endpoints.
- [ ] Use HTTPS and secure cookie/session handling (if sessions used).

### Secret rotation runbook (dev/staging)
- [ ] Generate a new strong Postgres password; update `POSTGRES_PASSWORD` in `.env` and `DATABASE_URL` to match.
- [ ] Restart database: `docker compose up -d db` (from `Back-End/`).
- [ ] Recreate Prisma client if needed: `npm run prisma:generate`.
- [ ] Verify API can connect (healthcheck, simple DB query).
- [ ] In production, rotate credentials via managed secret store and rolling deploys.

## Reliability & Observability
- [ ] Add logging of errors and order events (structured logs).
- [ ] Add basic health check endpoints for monitoring.
- [ ] Implement retry/backoff for external API calls (Maps, Sheets, Email).

## Testing
- [ ] Unit tests for business logic (distance fee calculation, order total).
- [ ] Integration tests for API endpoints with mocked external services.
- [ ] E2E tests that exercise full order flow (frontend + backend) in staging.

## Deployment
- [ ] Create production-ready Dockerfile or deployment scripts.
- [ ] Setup CI to run tests and build artifacts.
- [ ] Run migration scripts in staging and confirm data integrity.

## Documentation
- [ ] Add README for backend with setup, run, test, and deploy instructions.
- [ ] Document expected webhook formats and sample request/response payloads.

---

Keep this checklist updated and attach test logs for review.
