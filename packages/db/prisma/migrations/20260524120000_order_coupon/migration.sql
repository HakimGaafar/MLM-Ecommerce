-- Persist applied coupon on orders (checkout v1)
ALTER TABLE "orders" ADD COLUMN "coupon_id" TEXT;
ALTER TABLE "orders" ADD COLUMN "coupon_code_snapshot" VARCHAR(32);

ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_fkey"
  FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "orders_coupon_id_idx" ON "orders"("coupon_id");
