# Front-End Testing

Last updated: 2025-09-19

## Tooling
- Vitest + Testing Library + jsdom

## Commands
```
npm run test     # run tests
npm run test:ui  # with UI
```

## Suggested tests
- Components: ProductCard, CartDrawer, CategoryChips
- Pages: Add-to-cart flow, checkout validation
- Store: cart store (price calc, add/remove, extras)
- i18n: renders EN/TH labels correctly
- API: mock Axios; validate CSRF header on mutating requests

## CI
See `.github/workflows/ci.yml` (root). Consider adding coverage thresholds.
