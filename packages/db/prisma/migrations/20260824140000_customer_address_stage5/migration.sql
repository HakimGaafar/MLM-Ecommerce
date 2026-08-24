-- Stage 5: country-specific customer address fields + map pin

ALTER TABLE "customer_shipping_addresses"
  ADD COLUMN "governorate" VARCHAR(120),
  ADD COLUMN "neighborhood" VARCHAR(120),
  ADD COLUMN "building" VARCHAR(120),
  ADD COLUMN "full_address" VARCHAR(500),
  ADD COLUMN "short_national_address" VARCHAR(64),
  ADD COLUMN "latitude" DECIMAL(10,7),
  ADD COLUMN "longitude" DECIMAL(10,7);
