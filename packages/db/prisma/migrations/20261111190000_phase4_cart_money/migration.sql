-- Phase 4: order FX lock + International dual-price secondary OMR on offers.

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "charge_currency" CHAR(3),
  ADD COLUMN IF NOT EXISTS "ledger_currency" CHAR(3),
  ADD COLUMN IF NOT EXISTS "locked_fx_rate" DECIMAL(18, 8);

UPDATE "orders" o
SET
  "charge_currency" = COALESCE(o."charge_currency", m."default_currency"),
  "ledger_currency" = COALESCE(o."ledger_currency", m."default_currency")
FROM "markets" m
WHERE m."id" = o."market_id";

UPDATE "orders"
SET
  "charge_currency" = COALESCE("charge_currency", 'SAR'),
  "ledger_currency" = COALESCE("ledger_currency", 'SAR')
WHERE "charge_currency" IS NULL OR "ledger_currency" IS NULL;

ALTER TABLE "orders"
  ALTER COLUMN "charge_currency" SET DEFAULT 'SAR',
  ALTER COLUMN "ledger_currency" SET DEFAULT 'SAR',
  ALTER COLUMN "charge_currency" SET NOT NULL,
  ALTER COLUMN "ledger_currency" SET NOT NULL;

ALTER TABLE "product_market_offers"
  ADD COLUMN IF NOT EXISTS "secondary_price" DECIMAL(18, 2),
  ADD COLUMN IF NOT EXISTS "secondary_currency" CHAR(3);
