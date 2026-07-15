-- Phase X2: market_id on core tables; backfill all legacy rows to Saudi (market_sa)

-- Vendors
ALTER TABLE "vendors" ADD COLUMN "market_id" TEXT;
UPDATE "vendors" SET "market_id" = 'market_sa' WHERE "market_id" IS NULL;
ALTER TABLE "vendors" ALTER COLUMN "market_id" SET NOT NULL;
DROP INDEX IF EXISTS "vendors_slug_key";
CREATE UNIQUE INDEX "vendors_market_id_slug_key" ON "vendors"("market_id", "slug");
CREATE INDEX "vendors_market_id_idx" ON "vendors"("market_id");
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Product categories
ALTER TABLE "product_categories" ADD COLUMN "market_id" TEXT;
UPDATE "product_categories" SET "market_id" = 'market_sa' WHERE "market_id" IS NULL;
ALTER TABLE "product_categories" ALTER COLUMN "market_id" SET NOT NULL;
DROP INDEX IF EXISTS "product_categories_slug_key";
CREATE UNIQUE INDEX "product_categories_market_id_slug_key" ON "product_categories"("market_id", "slug");
CREATE INDEX "product_categories_market_id_idx" ON "product_categories"("market_id");
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Products
ALTER TABLE "products" ADD COLUMN "market_id" TEXT;
UPDATE "products" SET "market_id" = 'market_sa' WHERE "market_id" IS NULL;
ALTER TABLE "products" ALTER COLUMN "market_id" SET NOT NULL;
CREATE INDEX "products_market_id_idx" ON "products"("market_id");
CREATE INDEX "products_market_id_status_category_id_idx" ON "products"("market_id", "status", "category_id");
ALTER TABLE "products" ADD CONSTRAINT "products_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Orders
ALTER TABLE "orders" ADD COLUMN "market_id" TEXT;
UPDATE "orders" SET "market_id" = 'market_sa' WHERE "market_id" IS NULL;
ALTER TABLE "orders" ALTER COLUMN "market_id" SET NOT NULL;
CREATE INDEX "orders_market_id_idx" ON "orders"("market_id");
CREATE INDEX "orders_buyer_user_id_market_id_created_at_idx" ON "orders"("buyer_user_id", "market_id", "created_at");
ALTER TABLE "orders" ADD CONSTRAINT "orders_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Carts
ALTER TABLE "carts" ADD COLUMN "market_id" TEXT;
UPDATE "carts" SET "market_id" = 'market_sa' WHERE "market_id" IS NULL;
ALTER TABLE "carts" ALTER COLUMN "market_id" SET NOT NULL;
DROP INDEX IF EXISTS "carts_user_id_key";
CREATE UNIQUE INDEX "carts_user_id_market_id_key" ON "carts"("user_id", "market_id");
CREATE INDEX "carts_market_id_idx" ON "carts"("market_id");
ALTER TABLE "carts" ADD CONSTRAINT "carts_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
