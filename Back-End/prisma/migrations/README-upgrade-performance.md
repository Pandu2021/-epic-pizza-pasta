# Performance Upgrade Notes

Added indexes to `MenuItem` model for `category` and `updatedAt`.

Steps to apply:

1. Generate new migration:
   npx prisma migrate dev --name add_menu_indexes
2. (In production) use:
   npx prisma migrate deploy
3. Verify indexes:
   npx prisma studio (optional) or inspect DB: \d "MenuItem"

Environment additions in `.env.example`:
- MENU_CACHE_TTL_MS (default 60000)
- PREWARM_MENU=true (preloads menu into memory on boot)
- HTTP_LOG=true (set to false to reduce logging noise and latency)

Enable compression was added in `main.ts` to reduce payload size.

Controller `menu.controller.ts` now uses `select` to avoid over-selecting columns.
