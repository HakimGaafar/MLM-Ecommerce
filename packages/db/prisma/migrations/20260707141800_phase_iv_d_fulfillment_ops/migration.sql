-- Phase IV-d: fulfillment operations per (order, vendor, fulfillmentType)

ALTER TABLE "order_items" ADD COLUMN "fulfillment_type" "ProductFulfillmentType" NOT NULL DEFAULT 'DIRECT';

UPDATE "order_items" oi
SET "fulfillment_type" = p."fulfillment_type"
FROM "products" p
WHERE oi."product_id" = p."id";

ALTER TABLE "order_vendor_shipping" ADD COLUMN "fulfillment_status" "OrderStatus" NOT NULL DEFAULT 'NEW';
ALTER TABLE "order_vendor_shipping" ADD COLUMN "fulfillment_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill shipping rows for legacy orders that have items but no group row
INSERT INTO "order_vendor_shipping" (
  "id",
  "order_id",
  "vendor_id",
  "vendor_name_snapshot",
  "fulfillment_type",
  "shipping_mode",
  "indirect_fulfillment",
  "fee",
  "fulfillment_status",
  "fulfillment_updated_at",
  "created_at"
)
SELECT
  'c' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
  g."order_id",
  g."vendor_id",
  g."vendor_name_snapshot",
  g."fulfillment_type",
  CASE WHEN g."fulfillment_type" = 'DIRECT' THEN 'DIRECT'::"VendorShippingMode" ELSE 'INDIRECT'::"VendorShippingMode" END,
  CASE
    WHEN g."fulfillment_type" = 'FORSEIZ_STOCK' THEN 'FORSEIZ_STOCK'::"VendorIndirectFulfillment"
    WHEN g."fulfillment_type" = 'ON_ORDER' THEN 'ON_ORDER'::"VendorIndirectFulfillment"
    ELSE NULL
  END,
  CASE
    WHEN g."fulfillment_type" = 'DIRECT' THEN 15.00
    WHEN g."fulfillment_type" = 'FORSEIZ_STOCK' THEN 0.00
    ELSE 20.00
  END,
  g."fulfillment_status",
  g."fulfillment_updated_at",
  CURRENT_TIMESTAMP
FROM (
  SELECT
    oi."order_id",
    oi."vendor_id",
    MAX(oi."vendor_name_snapshot") AS "vendor_name_snapshot",
    oi."fulfillment_type",
    (
      SELECT oi2."vendor_fulfillment_status"
      FROM "order_items" oi2
      WHERE oi2."order_id" = oi."order_id"
        AND oi2."vendor_id" = oi."vendor_id"
        AND oi2."fulfillment_type" = oi."fulfillment_type"
      ORDER BY oi2."vendor_fulfillment_updated_at" DESC
      LIMIT 1
    ) AS "fulfillment_status",
    (
      SELECT MAX(oi2."vendor_fulfillment_updated_at")
      FROM "order_items" oi2
      WHERE oi2."order_id" = oi."order_id"
        AND oi2."vendor_id" = oi."vendor_id"
        AND oi2."fulfillment_type" = oi."fulfillment_type"
    ) AS "fulfillment_updated_at"
  FROM "order_items" oi
  GROUP BY oi."order_id", oi."vendor_id", oi."fulfillment_type"
) g
WHERE NOT EXISTS (
  SELECT 1
  FROM "order_vendor_shipping" ovs
  WHERE ovs."order_id" = g."order_id"
    AND ovs."vendor_id" = g."vendor_id"
    AND ovs."fulfillment_type" = g."fulfillment_type"
);

-- Sync group status from items where rows already exist
UPDATE "order_vendor_shipping" ovs
SET
  "fulfillment_status" = sub."fulfillment_status",
  "fulfillment_updated_at" = sub."fulfillment_updated_at"
FROM (
  SELECT
    oi."order_id",
    oi."vendor_id",
    oi."fulfillment_type",
    (
      SELECT oi2."vendor_fulfillment_status"
      FROM "order_items" oi2
      WHERE oi2."order_id" = oi."order_id"
        AND oi2."vendor_id" = oi."vendor_id"
        AND oi2."fulfillment_type" = oi."fulfillment_type"
      ORDER BY oi2."vendor_fulfillment_updated_at" DESC
      LIMIT 1
    ) AS "fulfillment_status",
    MAX(oi."vendor_fulfillment_updated_at") AS "fulfillment_updated_at"
  FROM "order_items" oi
  GROUP BY oi."order_id", oi."vendor_id", oi."fulfillment_type"
) sub
WHERE ovs."order_id" = sub."order_id"
  AND ovs."vendor_id" = sub."vendor_id"
  AND ovs."fulfillment_type" = sub."fulfillment_type";

CREATE INDEX "order_vendor_shipping_order_id_fulfillment_type_fulfillment_status_idx"
  ON "order_vendor_shipping"("order_id", "fulfillment_type", "fulfillment_status");
