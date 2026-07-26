-- Phase 6 polish: backfill ProductMarketOffer from legacy Product.price for products with no offers yet.
-- Safe to re-run: only inserts missing (product_id, market_id) pairs.

INSERT INTO "product_market_offers" (
  "id",
  "product_id",
  "market_id",
  "price",
  "currency",
  "stock_location",
  "warehouse_id",
  "quantity",
  "created_at",
  "updated_at"
)
SELECT
  'offer_' || p."id",
  p."id",
  p."market_id",
  p."price",
  LEFT(UPPER(p."currency"), 3),
  CASE
    WHEN p."fulfillment_type" = 'FORSEIZ_STOCK' THEN 'FOURCES_WAREHOUSE'::"ProductStockLocation"
    ELSE 'MERCHANT'::"ProductStockLocation"
  END,
  CASE
    WHEN p."fulfillment_type" = 'FORSEIZ_STOCK' AND p."market_id" = 'market_sa' THEN 'warehouse_sa'
    WHEN p."fulfillment_type" = 'FORSEIZ_STOCK' AND p."market_id" = 'market_om' THEN 'warehouse_om'
    WHEN p."fulfillment_type" = 'FORSEIZ_STOCK' AND p."market_id" = 'market_eg' THEN 'warehouse_eg'
    ELSE NULL
  END,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "products" p
WHERE NOT EXISTS (
  SELECT 1
  FROM "product_market_offers" o
  WHERE o."product_id" = p."id"
);
