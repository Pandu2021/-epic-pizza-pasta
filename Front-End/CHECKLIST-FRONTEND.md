# Front-End Checklist — Epic Pizza & Pasta

Use this checklist to focus on front-end deliverables, testing, and deploy readiness.

## UI / UX
- [ ] Finalize design and layout for desktop and mobile (responsive breakpoints).
- [ ] Implement bilingual text resources (English & Thai).
- [ ] Create accessible components (ARIA labels, keyboard navigation).

## Menu & Product UI
- [ ] Implement dynamic menu editor view for admin: categories, items, modifiers, halves, add-ons.
- [ ] Implement product detail modal with options and price updates.
- [ ] Implement cart UI with item edits, modifiers, and summary.

## Checkout & Payments
- [ ] Implement checkout form (address capture, phone, delivery/pickup toggle).
- [ ] Display PromptPay QR code with clear instructions and payment status UI.
- [ ] Support card payment flow UI hooks (for Omise) and show payment statuses.
- [ ] Client-side validation for inputs and helpful error messages.

## Integration & API
- [ ] Wire frontend to backend API endpoints (menu, create order, payment status, order status).
- [ ] Implement geocoding/address autocompletion (if used) with Maps Places API.
- [ ] Implement retry and error handling for network failures.

## Testing
- [ ] Unit tests for core UI components.
- [ ] Integration/E2E tests for checkout flow, QR display, and orders.
- [ ] Cross-browser testing (Chrome, Edge, Safari mobile) and mobile device checks.

## Build & Deploy
- [ ] Create build script and CI step to produce production assets.
- [ ] Document env variables and secrets required for frontend (only non-sensitive config).
- [ ] Prepare deployment steps or CDN configuration for static assets.

## Documentation
- [ ] Add README for frontend with dev run/build/test instructions.
- [ ] Add translation instructions and where to update copy.

---

Mark tasks as done as you complete them and attach screenshots for UI acceptance.
