-- Add optional LINE user identifier for multi-channel notifications
ALTER TABLE "User" ADD COLUMN "lineUserId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_lineUserId_key" ON "User"("lineUserId") WHERE "lineUserId" IS NOT NULL;
