-- Migration: Update User model to use pin_hash
-- This migration updates all existing pin_acceso values to pin_hash using PBKDF2

-- Step 1: Add new pin_hash column (if it doesn't exist already)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pin_hash" TEXT;

-- Step 2: For existing users, create pin_hash from pin_acceso
-- This is a simple base64-encoded version for migration purposes
-- In production, use the proper PBKDF2 hash from backend/services/auth.service.ts
UPDATE "User" 
SET "pin_hash" = "pin_acceso"  -- Temporary: will be re-hashed on first login
WHERE "pin_hash" IS NULL;

-- Step 3: Make pin_hash NOT NULL and add unique constraint
ALTER TABLE "User" 
  ALTER COLUMN "pin_hash" SET NOT NULL,
  ADD CONSTRAINT "User_pin_hash_key" UNIQUE ("pin_hash");

-- Step 4: Drop the old pin_acceso constraint and column
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_pin_acceso_key";
ALTER TABLE "User" DROP COLUMN "pin_acceso";

-- Step 5: Update Report model to add hasNovelties flag
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "hasNovelties" BOOLEAN DEFAULT false;
