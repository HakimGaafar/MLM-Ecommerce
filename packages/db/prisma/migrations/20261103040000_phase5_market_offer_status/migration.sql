-- Phase 5: per-market listing approval on product_market_offers.

DO $$ BEGIN
  CREATE TYPE "ProductMarketOfferStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "product_market_offers"
  ADD COLUMN IF NOT EXISTS "status" "ProductMarketOfferStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewed_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "rejection_reason" VARCHAR(1000);

-- Existing live products: treat current offers as already approved in that market.
UPDATE "product_market_offers" AS o
SET
  "status" = 'APPROVED',
  "reviewed_at" = COALESCE(o."reviewed_at", NOW())
FROM "products" p
WHERE o."product_id" = p."id"
  AND p."status" = 'PUBLISHED'
  AND o."status" = 'DRAFT';

-- Pending / changes-requested products: offers awaiting review.
UPDATE "product_market_offers" AS o
SET
  "status" = 'PENDING',
  "submitted_at" = COALESCE(o."submitted_at", NOW())
FROM "products" p
WHERE o."product_id" = p."id"
  AND p."status" IN ('PENDING', 'CHANGES_REQUESTED')
  AND o."status" = 'DRAFT';

CREATE INDEX IF NOT EXISTS "product_market_offers_market_id_status_idx"
  ON "product_market_offers"("market_id", "status");

CREATE INDEX IF NOT EXISTS "product_market_offers_status_submitted_at_idx"
  ON "product_market_offers"("status", "submitted_at");

DO $$ BEGIN
  ALTER TABLE "product_market_offers"
    ADD CONSTRAINT "product_market_offers_reviewed_by_user_id_fkey"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
