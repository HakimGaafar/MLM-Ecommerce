-- Phase 7: platform coupons + wishlist.

CREATE TABLE IF NOT EXISTS "platform_coupons" (
  "id" TEXT NOT NULL,
  "market_id" TEXT NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "description" VARCHAR(500),
  "discount_type" "CouponDiscountType" NOT NULL,
  "discount_value" DECIMAL(18, 2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "status" "CouponStatus" NOT NULL DEFAULT 'DRAFT',
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "usage_limit" INTEGER,
  "used_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_coupons_market_id_code_key"
  ON "platform_coupons"("market_id", "code");
CREATE INDEX IF NOT EXISTS "platform_coupons_market_id_status_idx"
  ON "platform_coupons"("market_id", "status");

DO $$ BEGIN
  ALTER TABLE "platform_coupons"
    ADD CONSTRAINT "platform_coupons_market_id_fkey"
    FOREIGN KEY ("market_id") REFERENCES "markets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "wishlist_items" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "market_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "wishlist_items_user_id_market_id_product_id_key"
  ON "wishlist_items"("user_id", "market_id", "product_id");
CREATE INDEX IF NOT EXISTS "wishlist_items_user_id_market_id_created_at_idx"
  ON "wishlist_items"("user_id", "market_id", "created_at");
CREATE INDEX IF NOT EXISTS "wishlist_items_product_id_idx"
  ON "wishlist_items"("product_id");

DO $$ BEGIN
  ALTER TABLE "wishlist_items"
    ADD CONSTRAINT "wishlist_items_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "wishlist_items"
    ADD CONSTRAINT "wishlist_items_market_id_fkey"
    FOREIGN KEY ("market_id") REFERENCES "markets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "wishlist_items"
    ADD CONSTRAINT "wishlist_items_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
