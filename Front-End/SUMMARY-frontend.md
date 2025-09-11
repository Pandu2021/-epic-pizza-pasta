# Front-End Summary

## Current State
React + Vite + TS app with routing, menu browsing, product detail (sizes & limited extras), cart persistence, and bilingual UI.

## Implemented
- Route structure (`/`, `/menu`, `/menu/:id`, `/cart`, etc.)
- Product listing with search & highlight
- Product detail: size selector (L / XL), extras (Extra Cheese size-based, Garlic Butter)
- Add-to-cart flow with variant gating (pizzas force detail page)
- Zustand cart store (persist to localStorage) with quantity updates
- Basic i18n (EN/TH); added key `choose_options`
- UI components: Carousel, Category chips, ProductCard variant modes
- Build pipeline & Tailwind styling

## Known Issues / Gaps
| Area | Issue | Action |
|------|-------|--------|
| Variants | Half/Half not supported | Add variant builder modal |
| Extras | Hard-coded in `ProductPage` | Fetch from API / config file |
| Data | Duplicate menu source (API vs `src/data/menu.ts`) | Remove static or fallback only |
| Cart | No edit of extras/size post-add | Add edit modal in cart drawer |
| Pricing | No breakdown (extras vs base) | Store line item meta & show tooltip |
| Performance | No code splitting or lazy images | Implement `React.lazy` + `loading="lazy"` |
| A11y | Size buttons not ARIA groups | Use role="radiogroup" with radios |
| Testing | Minimal tests only | Add Vitest suites for cart + price logic |
| Error Handling | Silent fetch catches | Surface toast + retry |
| SEO | Single title & no meta per route | Add react-helmet async/meta module |

## Recommended Next Steps
1. Remove static menu file or wrap as offline fallback with version stamp.
2. Introduce React Query (TanStack) for menu & product caching + refetch stale.
3. Abstract variant & extras logic into `src/domain/variants.ts`.
4. Add cart line item edit & remove extras breakdown.
5. A11y pass (keyboard focus, ARIA for interactive controls).
6. Implement route-based code splitting.
7. Testing: add snapshot & behavior tests for ProductPage variant pricing & cart merge logic.
8. Add global error boundary + toast for API failures.
9. Integrate authentication for protected pages (orders history, profile advanced features).
10. Add Lighthouse budget & performance CI check.

## Metrics To Track (Future)
- CLS/LCP/FID via Web Vitals
- Cart add conversion rate
- Drop-off at product detail vs checkout

---
This document should be updated after each feature milestone.
