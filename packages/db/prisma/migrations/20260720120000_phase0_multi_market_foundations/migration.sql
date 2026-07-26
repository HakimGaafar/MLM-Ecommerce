-- Phase 0: multi-market foundations
-- Additive only: primary market on vendors, FOURCES warehouses, product market offers.
-- Existing Product.price / fulfillmentType / checkout behavior unchanged.

-- Enums
CREATE TYPE "ShippingPackageType" AS ENUM (
  'FOURCES_DOMESTIC',
  'FOURCES_INTERNATIONAL',
  'MERCHANT_DOMESTIC',
  'MERCHANT_INTERNATIONAL'
);

CREATE TYPE "ProductStockLocation" AS ENUM (
  'MERCHANT',
  'FOURCES_WAREHOUSE'
);

-- FOURCES warehouses (SA / OM / EG only — no GLOBAL warehouse)
CREATE TABLE "fources_warehouses" (
  "id" TEXT NOT NULL,
  "market_id" TEXT NOT NULL,
  "country_code" CHAR(2) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fources_warehouses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fources_warehouses_market_id_key" ON "fources_warehouses"("market_id");
CREATE INDEX "fources_warehouses_country_code_idx" ON "fources_warehouses"("country_code");

ALTER TABLE "fources_warehouses"
  ADD CONSTRAINT "fources_warehouses_market_id_fkey"
  FOREIGN KEY ("market_id") REFERENCES "markets"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "fources_warehouses" ("id", "market_id", "country_code", "name", "is_active", "created_at", "updated_at")
VALUES
  ('warehouse_sa', 'market_sa', 'SA', 'FOURCES Warehouse — Saudi Arabia', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('warehouse_om', 'market_om', 'OM', 'FOURCES Warehouse — Oman', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('warehouse_eg', 'market_eg', 'EG', 'FOURCES Warehouse — Egypt', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Product market offers (empty until Phase 2)
CREATE TABLE "product_market_offers" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "market_id" TEXT NOT NULL,
  "price" DECIMAL(18,2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "stock_location" "ProductStockLocation" NOT NULL,
  "warehouse_id" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_market_offers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_market_offers_product_id_market_id_key"
  ON "product_market_offers"("product_id", "market_id");
CREATE INDEX "product_market_offers_market_id_idx" ON "product_market_offers"("market_id");
CREATE INDEX "product_market_offers_warehouse_id_idx" ON "product_market_offers"("warehouse_id");

ALTER TABLE "product_market_offers"
  ADD CONSTRAINT "product_market_offers_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_market_offers"
  ADD CONSTRAINT "product_market_offers_market_id_fkey"
  FOREIGN KEY ("market_id") REFERENCES "markets"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_market_offers"
  ADD CONSTRAINT "product_market_offers_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "fources_warehouses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Vendor primary market (home classification from country)
ALTER TABLE "vendors" ADD COLUMN "primary_market_id" TEXT;

UPDATE "vendors" v
SET "primary_market_id" = CASE UPPER(TRIM(v."country_code"))
  WHEN 'SA' THEN 'market_sa'
  WHEN 'OM' THEN 'market_om'
  WHEN 'EG' THEN 'market_eg'
  ELSE 'market_global'
END
WHERE v."primary_market_id" IS NULL;

-- Fallback for any unexpected NULL country
UPDATE "vendors"
SET "primary_market_id" = 'market_global'
WHERE "primary_market_id" IS NULL;

ALTER TABLE "vendors"
  ALTER COLUMN "primary_market_id" SET NOT NULL;

CREATE INDEX "vendors_primary_market_id_idx" ON "vendors"("primary_market_id");

ALTER TABLE "vendors"
  ADD CONSTRAINT "vendors_primary_market_id_fkey"
  FOREIGN KEY ("primary_market_id") REFERENCES "markets"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
