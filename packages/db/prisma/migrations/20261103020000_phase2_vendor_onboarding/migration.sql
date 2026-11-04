-- Phase 2: vendor onboarding statuses, bilingual fields, field review, change requests, product request_changes

CREATE TYPE "VendorOnboardingStatus" AS ENUM ('UNDER_REGISTRATION', 'UNDER_REVIEW', 'ACTIVE');
CREATE TYPE "VendorOnboardingFieldDecision" AS ENUM ('PENDING', 'ACCEPTED', 'NEEDS_FIX');
CREATE TYPE "VendorEntityType" AS ENUM ('INDIVIDUAL', 'COMPANY', 'ESTABLISHMENT', 'FREELANCE', 'OTHER');

DO $$ BEGIN ALTER TYPE "ProductStatus" ADD VALUE 'CHANGES_REQUESTED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "ProductReviewAction" ADD VALUE 'REQUESTED_CHANGES'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "onboarding_status" "VendorOnboardingStatus" NOT NULL DEFAULT 'UNDER_REGISTRATION';
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "onboarding_step" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "onboarding_submitted_at" TIMESTAMP(3);
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "rep_name_en" VARCHAR(120);
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "rep_name_other" VARCHAR(120);
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "legal_name_en" VARCHAR(200);
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "legal_name_other" VARCHAR(200);
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "store_name_other" VARCHAR(120);
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "store_description_en" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "store_description_other" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "entity_type" "VendorEntityType";
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "short_business_note" VARCHAR(500);
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "commission_terms_accepted_at" TIMESTAMP(3);
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "cross_market_terms_accepted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "vendors_onboarding_status_idx" ON "vendors"("onboarding_status");

-- Backfill: approved stores → ACTIVE; pending → UNDER_REVIEW; else keep UNDER_REGISTRATION
UPDATE "vendors" SET "onboarding_status" = 'ACTIVE' WHERE "store_approval_status" = 'APPROVED';
UPDATE "vendors" SET "onboarding_status" = 'UNDER_REVIEW', "onboarding_step" = 6
  WHERE "store_approval_status" = 'PENDING' AND "onboarding_status" = 'UNDER_REGISTRATION';

CREATE TABLE IF NOT EXISTS "vendor_onboarding_field_reviews" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "page_key" VARCHAR(32) NOT NULL,
    "field_key" VARCHAR(64) NOT NULL,
    "decision" "VendorOnboardingFieldDecision" NOT NULL DEFAULT 'PENDING',
    "note" VARCHAR(1000),
    "decided_by_user_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vendor_onboarding_field_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "vendor_onboarding_field_reviews_vendor_id_page_key_field_key_key"
  ON "vendor_onboarding_field_reviews"("vendor_id", "page_key", "field_key");
CREATE INDEX IF NOT EXISTS "vendor_onboarding_field_reviews_vendor_id_page_key_idx"
  ON "vendor_onboarding_field_reviews"("vendor_id", "page_key");

DO $$ BEGIN
  ALTER TABLE "vendor_onboarding_field_reviews" ADD CONSTRAINT "vendor_onboarding_field_reviews_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "vendor_profile_change_requests" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    "proposed_json" JSONB NOT NULL,
    "vendor_note" VARCHAR(2000),
    "admin_note" VARCHAR(2000),
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vendor_profile_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vendor_profile_change_requests_vendor_id_status_created_at_idx"
  ON "vendor_profile_change_requests"("vendor_id", "status", "created_at");

DO $$ BEGIN
  ALTER TABLE "vendor_profile_change_requests" ADD CONSTRAINT "vendor_profile_change_requests_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
