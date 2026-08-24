-- Stage 4: platform shipping rates, merchant delivery cities, FOURCES A/B on offers

CREATE TABLE "shipping_rates" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "package_type" "ShippingPackageType" NOT NULL,
    "fources_mode" "VendorIndirectFulfillment",
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'SAR',
    "per_unit" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shipping_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shipping_rates_code_key" ON "shipping_rates"("code");
CREATE INDEX "shipping_rates_package_type_fources_mode_is_active_idx" ON "shipping_rates"("package_type", "fources_mode", "is_active");

INSERT INTO "shipping_rates" ("id", "code", "package_type", "fources_mode", "amount", "currency", "per_unit", "is_active", "created_at", "updated_at")
VALUES
  ('shiprate_md', 'MERCHANT_DOMESTIC', 'MERCHANT_DOMESTIC', NULL, 15.00, 'SAR', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('shiprate_mi', 'MERCHANT_INTERNATIONAL', 'MERCHANT_INTERNATIONAL', NULL, 25.00, 'SAR', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('shiprate_fds', 'FOURCES_DOMESTIC_STOCK', 'FOURCES_DOMESTIC', 'FORSEIZ_STOCK', 5.00, 'SAR', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('shiprate_fdo', 'FOURCES_DOMESTIC_ON_ORDER', 'FOURCES_DOMESTIC', 'ON_ORDER', 20.00, 'SAR', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('shiprate_fis', 'FOURCES_INTERNATIONAL_STOCK', 'FOURCES_INTERNATIONAL', 'FORSEIZ_STOCK', 15.00, 'SAR', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('shiprate_fio', 'FOURCES_INTERNATIONAL_ON_ORDER', 'FOURCES_INTERNATIONAL', 'ON_ORDER', 30.00, 'SAR', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

CREATE TABLE "vendor_delivery_cities" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vendor_delivery_cities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vendor_delivery_cities_vendor_id_country_code_city_key" ON "vendor_delivery_cities"("vendor_id", "country_code", "city");
CREATE INDEX "vendor_delivery_cities_vendor_id_country_code_idx" ON "vendor_delivery_cities"("vendor_id", "country_code");

ALTER TABLE "vendor_delivery_cities"
  ADD CONSTRAINT "vendor_delivery_cities_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_market_offers"
  ADD COLUMN "fources_mode" "VendorIndirectFulfillment";

-- Existing FOURCES offers default to pre-stocked (A)
UPDATE "product_market_offers"
SET "fources_mode" = 'FORSEIZ_STOCK'
WHERE "stock_location" = 'FOURCES_WAREHOUSE';
