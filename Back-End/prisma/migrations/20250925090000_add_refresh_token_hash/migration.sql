-- Migration: add refreshTokenHash to User for secure refresh token rotation
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "refreshTokenHash" TEXT;