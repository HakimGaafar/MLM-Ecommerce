-- Phase IV: per-vendor shipping modes, approval workflow, checkout breakdown

CREATE TYPE "VendorShippingMode" AS ENUM ('DIRECT', 'INDIRECT');
CREATE TYPE "VendorIndirectFulfillment" AS ENUM ('FORSEIZ_STOCK', 'ON_ORDER');
CREATE TYPE "VendorShippingProfileStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED');
CREATE TYPE "VendorShippingChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "VendorShippingAuditActor" AS ENUM ('ADMIN', 'VENDOR_REQUEST_APPROVED', 'SYSTEM');

ALTER TABLE "vendors"
  ADD COLUMN "shipping_mode" "VendorShippingMode" NOT NULL DEFAULT 'DIRECT',
  ADD COLUMN "indirect_fulfillment" "VendorIndirectFulfillment",
  ADD COLUMN "shipping_fee" DECIMAL(18,2),
  ADD COLUMN "shipping_profile_status" "VendorShippingProfileStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  ADD COLUMN "shipping_approved_at" TIMESTAMP(3),
  ADD COLUMN "shipping_fee_set_by_admin" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "vendors_shipping_profile_status_idx" ON "vendors"("shipping_profile_status");

-- Existing vendors with shipping setup → approved with their fee or 15 SAR direct default
UPDATE "vendors"
SET
  "shipping_profile_status" = 'APPROVED',
  "shipping_fee" = COALESCE("default_shipping_fee", 15.00),
  "shipping_approved_at" = COALESCE("shipping_setup_at", NOW()),
  "shipping_mode" = 'DIRECT'
WHERE "shipping_setup_at" IS NOT NULL;

-- Vendors with published products (legacy) → approved so checkout keeps working
UPDATE "vendors"
SET
  "shipping_profile_status" = 'APPROVED',
  "shipping_fee" = COALESCE("shipping_fee", "default_shipping_fee", 15.00),
  "shipping_approved_at" = COALESCE("shipping_approved_at", NOW()),
  "shipping_mode" = 'DIRECT'
WHERE "id" IN (SELECT DISTINCT "vendor_id" FROM "products" WHERE "status" = 'PUBLISHED')
  AND "shipping_profile_status" = 'PENDING_APPROVAL';

CREATE TABLE "order_vendor_shipping" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "vendor_id" TEXT NOT NULL,
  "vendor_name_snapshot" VARCHAR(200) NOT NULL,
  "shipping_mode" "VendorShippingMode" NOT NULL,
  "indirect_fulfillment" "VendorIndirectFulfillment",
  "fee" DECIMAL(18,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_vendor_shipping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_vendor_shipping_order_id_vendor_id_key" ON "order_vendor_shipping"("order_id", "vendor_id");
CREATE INDEX "order_vendor_shipping_order_id_idx" ON "order_vendor_shipping"("order_id");

ALTER TABLE "order_vendor_shipping"
  ADD CONSTRAINT "order_vendor_shipping_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "order_vendor_shipping_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "vendor_shipping_change_requests" (
  "id" TEXT NOT NULL,
  "vendor_id" TEXT NOT NULL,
  "requested_mode" "VendorShippingMode" NOT NULL,
  "requested_indirect" "VendorIndirectFulfillment",
  "requested_fee" DECIMAL(18,2) NOT NULL,
  "requested_notes" VARCHAR(2000),
  "status" "VendorShippingChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "rejection_reason" TEXT,
  "reviewed_by_user_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendor_shipping_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vendor_shipping_change_requests_vendor_id_status_idx" ON "vendor_shipping_change_requests"("vendor_id", "status");
CREATE INDEX "vendor_shipping_change_requests_status_created_at_idx" ON "vendor_shipping_change_requests"("status", "created_at");

ALTER TABLE "vendor_shipping_change_requests"
  ADD CONSTRAINT "vendor_shipping_change_requests_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "vendor_shipping_change_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "vendor_shipping_audit_logs" (
  "id" TEXT NOT NULL,
  "vendor_id" TEXT NOT NULL,
  "actor_type" "VendorShippingAuditActor" NOT NULL,
  "actor_user_id" TEXT,
  "previous_mode" "VendorShippingMode",
  "new_mode" "VendorShippingMode" NOT NULL,
  "previous_indirect" "VendorIndirectFulfillment",
  "new_indirect" "VendorIndirectFulfillment",
  "previous_fee" DECIMAL(18,2),
  "new_fee" DECIMAL(18,2) NOT NULL,
  "note" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vendor_shipping_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vendor_shipping_audit_logs_vendor_id_created_at_idx" ON "vendor_shipping_audit_logs"("vendor_id", "created_at");

ALTER TABLE "vendor_shipping_audit_logs"
  ADD CONSTRAINT "vendor_shipping_audit_logs_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "vendor_shipping_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
