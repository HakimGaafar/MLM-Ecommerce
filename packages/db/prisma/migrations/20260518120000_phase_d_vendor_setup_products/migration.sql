-- Phase D: vendor setup fields, product approval workflow

CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'ON_HOLD');

ALTER TABLE "vendors"
  ADD COLUMN "shipping_notes" VARCHAR(2000),
  ADD COLUMN "default_shipping_fee" DECIMAL(18, 2),
  ADD COLUMN "shipping_setup_at" TIMESTAMP(3),
  ADD COLUMN "payout_account_holder" VARCHAR(200),
  ADD COLUMN "payout_iban" VARCHAR(34),
  ADD COLUMN "payout_setup_at" TIMESTAMP(3);

ALTER TABLE "products" ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT';

UPDATE "products"
SET "status" = CASE WHEN "is_active" = true THEN 'PUBLISHED'::"ProductStatus" ELSE 'DRAFT'::"ProductStatus" END;

UPDATE "products" SET "is_active" = ("status" = 'PUBLISHED');

CREATE INDEX "products_vendor_id_status_idx" ON "products"("vendor_id", "status");

ALTER TABLE "products" ALTER COLUMN "is_active" SET DEFAULT false;
