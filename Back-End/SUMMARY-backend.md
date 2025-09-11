# Back-End Summary

## Current State
NestJS + Prisma + PostgreSQL service providing menu, order, payment (PromptPay stub), and auth scaffolding.

## Implemented
- Prisma models: User, MenuItem, Order(+OrderItem), Payment, WebhookEvent
- Menu seed via `prisma/seed/menu.json`
- Basic menu retrieval & order creation endpoints (see API-CONTRACT.md)
- PromptPay QR generation utility (mock) & webhook signature validation
- Auth (JWT RS256) skeleton: login/me/refresh endpoints (cookies)
- Security middleware stack (helmet, CORS, validation, CSRF double-submit, rate limit base)
- Docker Compose (Postgres, Redis placeholder) & Dockerfile
- CI workflow (install, prisma generate, build, lint, test placeholder)

## Gaps / Pending
| Area | Gap | Impact | Recommendation |
|------|-----|--------|---------------|
| Documentation | No Swagger/OpenAPI | Harder client sync | Add `@nestjs/swagger` & generate spec |
| Validation | Limited DTO validation for all routes | Risk of invalid data | Add DTO classes + class-validator decorators |
| Auth | Missing password reset / refresh rotation hardening | Security gap | Implement refresh token store & revoke logic |
| Payments | PromptPay stub only | No real payment status | Integrate real provider or simulate full lifecycle |
| Menu Management | No admin CRUD endpoints | Manual seed edits | Add secured CRUD routes + image upload pipeline |
| Background Jobs | No queue processing | Cannot async send emails/webhooks | Add BullMQ + worker process |
| Logging/Observability | No structured logs / metrics | Hard to debug prod | Add pino logger + request IDs + health metrics |
| Testing | Few or no unit/integration tests | Regressions risk | Add Jest test suites (services, controllers) |
| Data Integrity | No constraints/pricing validation for variants | Pricing exploits | Central price calculator server-side |
| Rate Limiting | Basic or absent for sensitive endpoints | Abuse risk | Add per-route limiter (login/orders) |
| Deployment | No prod build/publish pipeline | Manual steps | Add GitHub Action release workflow |

## Immediate Fix Candidates
1. Add OpenAPI generator & publish spec artifact.
2. Centralize pricing & extras validation (server trust source-of-truth) before order insert.
3. Implement robust logging (pino) with correlation ID middleware.
4. Add integration test: create order -> simulate payment webhook -> assert status update.
5. Harden auth: rotate refresh tokens, add hashing + blacklist on logout.

## Data & Variant Strategy (Planned)
Introduce a `MenuVariant` concept (JSON or separate table) to model size, extras, half/half combinations. Server calculates final price, returns variantId to client for cart consistency.

## Operational To-Do
- Add health-liveness & readiness probes for container orchestration
- Add migration auto-run on startup behind env flag
- Backup strategy docs for PostgreSQL

---
Keep this file updated after each backend sprint.
