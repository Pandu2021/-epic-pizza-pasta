-- Add contact fields to Order for notification delivery
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "customerEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "lineUserId" TEXT;

-- Optional index to speed up lookups by email if required later
CREATE INDEX IF NOT EXISTS "Order_customerEmail_idx" ON "Order" ("customerEmail");
