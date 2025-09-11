# Front-End Design Brief

Goal: polished, responsive, accessible Pizza & Pasta storefront with product detail, cart/checkout, auth, order flows, and basic admin scaffolding.

## Pages (routes)
- Home: highlight categories and CTA to Menu.
- Menu (/menu): category chips, product grid, link to detail, quick add, skeleton on load.
- Product Detail (/menu/:id): image, description, pizza size selector (L/XL), quantity, price computed by size, add-to-cart, breadcrumbs.
- Cart (/cart): list, qty update, remove, total, checkout CTA.
- Checkout (/checkout): shipping address, delivery option, payment method (mock), order review, submit.
- Order Confirmation (/order-confirmation): thank you, link to continue shopping.
- Order History (/orders): list previous orders (placeholder to integrate backend later).
- Profile (/profile): basic profile and links to orders.
- Auth (/login, /register, /forgot-password): forms (placeholder), route guards to be added later.
- Admin: digantikan oleh Profile. Semua akses `/admin` akan di-redirect ke `/profile`. Jika nanti perlu admin, gunakan sub-path lain atau app terpisah.
- 404 (*): friendly not found.

## Components
- ProductCard: image, name, badges, price, link to detail + Add to Cart.
- CategoryChips: scroll to category sections.
- CartDrawer: quick cart view (existing).
- Skeleton: pulse placeholder blocks.
- Toast: ephemeral notifications.
- ErrorBoundary: top-level error fallback.

## Data & contracts
- Menu items shape in `src/data/menu.ts` (id, category, name/description by locale, priceL/priceXL or price, image, labels).
- Cart item shape in `src/store/cartStore.ts` (id includes variant for pizza, name, price, qty, image). Total and count selectors.

## i18n
- Use `react-i18next`; helper t(s) chooses `en`/`th` from LocaleText.
- Any new UI texts should be added to `src/i18n/locales/en.json` and `th.json`.

## A11y & responsiveness
- Semantic HTML, labelled inputs, focus-visible, aria-labels for icon-only buttons.
- Tailwind breakpoints: mobile-first; images responsive; lazy loading where practical.

## State & loading
- Patterns: idle → loading (Skeleton) → success → error (with retry). Toast for small confirmations.

## Testing
- Unit: stores and critical components.
- E2E: browse → add to cart → checkout → confirmation.
- A11y: axe/Lighthouse.

## Next steps
- Implement forms with React Hook Form + Zod on Checkout/Auth.
- Add protected routes and token handling.
- Integrate backend API in `src/services/api.ts`.
- Replace placeholders with real data and wire admin CRUD.
