-- Product-level service area (city scope set by vendor per product).
CREATE TYPE "ProductServiceAreaMode" AS ENUM ('ALL', 'SPECIFIC');

ALTER TABLE "products"
  ADD COLUMN "service_area_mode" "ProductServiceAreaMode" NOT NULL DEFAULT 'ALL';

CREATE TABLE "product_service_cities" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "country_code" CHAR(2) NOT NULL,
  "city" VARCHAR(120) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_service_cities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_service_cities_product_id_country_code_city_key"
  ON "product_service_cities"("product_id", "country_code", "city");

CREATE INDEX "product_service_cities_product_id_country_code_idx"
  ON "product_service_cities"("product_id", "country_code");

ALTER TABLE "product_service_cities"
  ADD CONSTRAINT "product_service_cities_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
