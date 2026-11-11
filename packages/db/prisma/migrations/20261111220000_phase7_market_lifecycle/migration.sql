-- Phase 7: Add Market wizard lifecycle + papers flag.

DO $$ BEGIN
  CREATE TYPE "MarketLifecycleStatus" AS ENUM ('DRAFT', 'READY', 'LIVE', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "markets"
  ADD COLUMN IF NOT EXISTS "lifecycle_status" "MarketLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "papers_complete" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "clone_source_code" VARCHAR(16);

-- Backfill from existing visibility flag.
UPDATE "markets"
SET "lifecycle_status" = CASE
  WHEN "is_active" = true THEN 'LIVE'::"MarketLifecycleStatus"
  ELSE 'DRAFT'::"MarketLifecycleStatus"
END;
