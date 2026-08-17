-- Idempotent: objects may already exist when an older revision of
-- 20260707100756_phase_iv_c_product_edit_review created them first.

DO $$ BEGIN
  CREATE TYPE "ProductReviewTarget" AS ENUM ('NEW_PRODUCT', 'EDIT_REQUEST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProductEditRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "order_vendor_shipping"
  ALTER COLUMN "fulfillment_type" DROP DEFAULT;

ALTER TABLE "product_reviews"
  ADD COLUMN IF NOT EXISTS "edit_request_id" TEXT,
  ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;

ALTER TABLE "product_reviews"
  ADD COLUMN IF NOT EXISTS "target" "ProductReviewTarget" NOT NULL DEFAULT 'NEW_PRODUCT';

CREATE TABLE IF NOT EXISTS "product_edit_requests" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "status" "ProductEditRequestStatus" NOT NULL DEFAULT 'PENDING',
    "proposed_name" TEXT,
    "proposed_price" DECIMAL(18,2),
    "proposed_currency" TEXT,
    "proposed_fulfillment_type" "ProductFulfillmentType",
    "proposed_meta_title" VARCHAR(70),
    "proposed_meta_description" VARCHAR(160),
    "proposed_images_json" JSONB,
    "rejection_reason" TEXT,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_edit_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "product_edit_requests_product_id_status_idx"
  ON "product_edit_requests"("product_id", "status");

CREATE INDEX IF NOT EXISTS "product_edit_requests_vendor_id_status_idx"
  ON "product_edit_requests"("vendor_id", "status");

CREATE INDEX IF NOT EXISTS "product_edit_requests_status_created_at_idx"
  ON "product_edit_requests"("status", "created_at");

DO $$ BEGIN
  ALTER TABLE "product_reviews"
    ADD CONSTRAINT "product_reviews_edit_request_id_fkey"
    FOREIGN KEY ("edit_request_id") REFERENCES "product_edit_requests"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "product_edit_requests"
    ADD CONSTRAINT "product_edit_requests_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "product_edit_requests"
    ADD CONSTRAINT "product_edit_requests_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "product_edit_requests"
    ADD CONSTRAINT "product_edit_requests_reviewed_by_user_id_fkey"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
