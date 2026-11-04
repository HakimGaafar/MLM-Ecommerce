-- Rebrand FOURCES → VANDSOQ (enums, columns, warehouse table, shipping rate codes).

-- ShippingPackageType enum values
ALTER TYPE "ShippingPackageType" RENAME VALUE 'FOURCES_DOMESTIC' TO 'VANDSOQ_DOMESTIC';
ALTER TYPE "ShippingPackageType" RENAME VALUE 'FOURCES_INTERNATIONAL' TO 'VANDSOQ_INTERNATIONAL';

-- ProductStockLocation enum values
ALTER TYPE "ProductStockLocation" RENAME VALUE 'FOURCES_WAREHOUSE' TO 'VANDSOQ_WAREHOUSE';

-- Columns
ALTER TABLE "shipping_rates" RENAME COLUMN "fources_mode" TO "vandsoq_mode";
ALTER TABLE "product_market_offers" RENAME COLUMN "fources_mode" TO "vandsoq_mode";

-- Indexes that referenced the old column name
DROP INDEX IF EXISTS "shipping_rates_market_id_package_type_fources_mode_is_active_idx";
DROP INDEX IF EXISTS "shipping_rates_package_type_fources_mode_is_active_idx";
CREATE INDEX "shipping_rates_market_id_package_type_vandsoq_mode_is_active_idx"
  ON "shipping_rates"("market_id", "package_type", "vandsoq_mode", "is_active");

-- Warehouse table
ALTER TABLE "fources_warehouses" RENAME TO "vandsoq_warehouses";
ALTER INDEX IF EXISTS "fources_warehouses_pkey" RENAME TO "vandsoq_warehouses_pkey";
ALTER INDEX IF EXISTS "fources_warehouses_market_id_key" RENAME TO "vandsoq_warehouses_market_id_key";
ALTER INDEX IF EXISTS "fources_warehouses_country_code_idx" RENAME TO "vandsoq_warehouses_country_code_idx";
ALTER TABLE "vandsoq_warehouses" RENAME CONSTRAINT "fources_warehouses_market_id_fkey" TO "vandsoq_warehouses_market_id_fkey";

UPDATE "vandsoq_warehouses"
SET "name" = REPLACE("name", 'FOURCES', 'VANDSOQ')
WHERE "name" LIKE '%FOURCES%';

UPDATE "vandsoq_warehouses"
SET "name" = REPLACE("name", 'Fources', 'Vandsoq')
WHERE "name" LIKE '%Fources%';

-- Shipping rate business codes (string column, not enum)
UPDATE "shipping_rates"
SET "code" = REPLACE("code", 'FOURCES_', 'VANDSOQ_')
WHERE "code" LIKE 'FOURCES_%';
