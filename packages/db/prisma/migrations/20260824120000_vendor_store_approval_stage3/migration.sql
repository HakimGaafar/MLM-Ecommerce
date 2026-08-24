-- Stage 3: store approval gate, proof-of-address KYC, coupon suspend/terminate

CREATE TYPE "VendorStoreApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

ALTER TYPE "KycDocumentType" ADD VALUE 'PROOF_OF_ADDRESS';

ALTER TYPE "CouponStatus" ADD VALUE 'SUSPENDED';
ALTER TYPE "CouponStatus" ADD VALUE 'TERMINATED';

ALTER TABLE "vendors"
  ADD COLUMN "store_approval_status" "VendorStoreApprovalStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "store_approved_at" TIMESTAMP(3),
  ADD COLUMN "store_approved_by_user_id" TEXT,
  ADD COLUMN "store_approval_note" VARCHAR(500);

CREATE INDEX "vendors_store_approval_status_idx" ON "vendors"("store_approval_status");

-- Grandfather existing stores so current catalog stays visible
UPDATE "vendors"
SET
  "store_approval_status" = 'APPROVED',
  "store_approved_at" = COALESCE("shipping_approved_at", "created_at");
