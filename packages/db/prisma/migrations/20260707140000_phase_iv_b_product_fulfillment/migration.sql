-- Phase IV-b: product-level fulfillment type; checkout groups by (vendor, fulfillment type)

CREATE TYPE "ProductFulfillmentType" AS ENUM ('DIRECT', 'FORSEIZ_STOCK', 'ON_ORDER');

ALTER TABLE "products"
  ADD COLUMN "fulfillment_type" "ProductFulfillmentType" NOT NULL DEFAULT 'DIRECT';

-- Backfill from vendor shipping profile
UPDATE "products" p
SET "fulfillment_type" = CASE
  WHEN v."shipping_mode" = 'DIRECT' THEN 'DIRECT'::"ProductFulfillmentType"
  WHEN v."indirect_fulfillment" = 'ON_ORDER' THEN 'ON_ORDER'::"ProductFulfillmentType"
  ELSE 'FORSEIZ_STOCK'::"ProductFulfillmentType"
END
FROM "vendors" v
WHERE p."vendor_id" = v."id";

ALTER TABLE "order_vendor_shipping"
  ADD COLUMN "fulfillment_type" "ProductFulfillmentType" NOT NULL DEFAULT 'DIRECT';

UPDATE "order_vendor_shipping"
SET "fulfillment_type" = CASE
  WHEN "shipping_mode" = 'DIRECT' THEN 'DIRECT'::"ProductFulfillmentType"
  WHEN "indirect_fulfillment" = 'ON_ORDER' THEN 'ON_ORDER'::"ProductFulfillmentType"
  ELSE 'FORSEIZ_STOCK'::"ProductFulfillmentType"
END;

DROP INDEX IF EXISTS "order_vendor_shipping_order_id_vendor_id_key";

CREATE UNIQUE INDEX "order_vendor_shipping_order_id_vendor_id_fulfillment_type_key"
  ON "order_vendor_shipping"("order_id", "vendor_id", "fulfillment_type");
