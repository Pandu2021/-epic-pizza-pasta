# Project Summary (Root)

## Scope
Epic Pizza & Pasta monorepo: React Front-End + NestJS Back-End + Prisma + PostgreSQL.

## Progress Overview
### Implemented
- Front-End routing, menu listing, product detail with size & extras (cheese L/XL, garlic butter)
- Add-to-cart flow updated: pizzas require navigation for options ("Choose Options" variant)
- Cart state with persistence (Zustand)
- Basic i18n (EN/TH) with dynamic category & button labels
- Back-End NestJS scaffold: core entities (User, MenuItem, Order, OrderItem, Payment, WebhookEvent)
- PromptPay utilities & webhook verification logic
- Prisma schema & seed (synchronized with front-end after removal of Super Sampler)
- CI workflow & Docker assets
- Hardened .gitignore across root / front / back

### Removed / Reverted
- Super Sampler experimental pizza (fully removed from seed & static data)

### Outstanding (Key Gaps)
- Menu variants: half/half (2 faces) selection not implemented
- Extras dynamic sourcing from API (currently hard-coded in ProductPage)
- Cart item editing (change size/extras after adding)
- Order & checkout integration (front-end to back-end payments) incomplete
- Authentication UI flows & protected routes minimal / placeholder
- Test coverage (unit + integration + e2e) very low
- API documentation (Swagger) missing
- Performance: bundle splitting & image optimization not applied
- Data duplication risk: front-end static menu file vs API seed

## Risks
| Area | Risk | Mitigation |
|------|------|------------|
| Data Sync | Divergence between `menu.json` and `src/data/menu.ts` | Remove static file or auto-fetch on first load with cache fallback |
| Variant Logic | Future complexity (half/half, 4 flavors) | Introduce normalized variant builder util early |
| Security | Env secrets leakage if future files missed | Periodic .gitignore audit + pre-commit hook |
| DX | Manual repetitive fetch calls | Introduce React Query & central menu store |
| Performance | Large initial JS bundle | Route-based code splitting + image lazy loading |

## Recommended Next Steps (Prioritized)
1. Canonical Menu Source: Remove `src/data/menu.ts` -> replace with API fetch + local cache.
2. Swagger Docs: Generate OpenAPI & sync client types.
3. Variant Architecture: Design schema for half/half & extras (server validated pricing).
4. Cart Enhancements: Editable line items & price breakdown (base + extras).
5. Auth Flow UI: Add login/register + token refresh integration; guard checkout.
6. Testing Baseline: Add unit tests for `cartStore`, price calculations, ProductPage extras; add e2e skeleton.
7. Performance: Code split by route, enable image `loading="lazy"`, add responsive sizes.
8. Observability: Add minimal logging & error boundary reporting (Sentry or placeholder).
9. Checkout Integration: Wire payment creation + status polling.
10. Deployment Pipeline: Add production Docker build & push workflow (tags & env matrix).

## Suggested Folder Additions
- `docs/` for architecture & API decisions (ADR style)
- `scripts/` root helpers (format, lint, typecheck all)
- `.husky/` for pre-commit hooks (lint & test)

---
(Front-End & Back-End detailed summaries located in their respective subfolders.)
