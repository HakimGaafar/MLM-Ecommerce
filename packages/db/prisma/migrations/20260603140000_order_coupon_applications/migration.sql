-- Multi-vendor coupon applications per order (same code on multiple stores)
CREATE TABLE "order_coupon_applications" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "coupon_code" VARCHAR(32) NOT NULL,
    "vendor_name_snapshot" VARCHAR(200) NOT NULL,
    "discount_type" "CouponDiscountType" NOT NULL,
    "discount_value" DECIMAL(18,2) NOT NULL,
    "discount_amount" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_coupon_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_coupon_applications_order_id_coupon_id_key"
  ON "order_coupon_applications"("order_id", "coupon_id");
CREATE INDEX "order_coupon_applications_order_id_idx" ON "order_coupon_applications"("order_id");
CREATE INDEX "order_coupon_applications_coupon_id_idx" ON "order_coupon_applications"("coupon_id");

ALTER TABLE "order_coupon_applications" ADD CONSTRAINT "order_coupon_applications_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_coupon_applications" ADD CONSTRAINT "order_coupon_applications_coupon_id_fkey"
  FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_coupon_applications" ADD CONSTRAINT "order_coupon_applications_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
