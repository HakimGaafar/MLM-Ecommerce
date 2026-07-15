-- Phase E: vendor coupons

CREATE TYPE "CouponStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED');
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENT', 'FIXED');

CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "description" VARCHAR(500),
    "discount_type" "CouponDiscountType" NOT NULL,
    "discount_value" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'SAR',
    "status" "CouponStatus" NOT NULL DEFAULT 'DRAFT',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "usage_limit" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coupons_vendor_id_code_key" ON "coupons"("vendor_id", "code");
CREATE INDEX "coupons_vendor_id_status_idx" ON "coupons"("vendor_id", "status");

ALTER TABLE "coupons" ADD CONSTRAINT "coupons_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
