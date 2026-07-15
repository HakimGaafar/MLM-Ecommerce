-- Phase X4: per-market platform_config (migrate Saudi singleton + seed OM/EG/GLOBAL)

ALTER TABLE "platform_config" ADD COLUMN "market_id" TEXT;
ALTER TABLE "platform_config" ADD COLUMN "vat_rate" DECIMAL(8,6);
ALTER TABLE "platform_config" ADD COLUMN "min_withdrawal_amount" DECIMAL(18,2);
ALTER TABLE "platform_config" ADD COLUMN "terms_url" VARCHAR(500);
ALTER TABLE "platform_config" ADD COLUMN "terms_text" TEXT;
ALTER TABLE "platform_config" ADD COLUMN "privacy_url" VARCHAR(500);
ALTER TABLE "platform_config" ADD COLUMN "privacy_text" TEXT;
ALTER TABLE "platform_config" ADD COLUMN "return_policy_url" VARCHAR(500);
ALTER TABLE "platform_config" ADD COLUMN "return_policy_text" TEXT;

UPDATE "platform_config"
SET
  "market_id" = 'market_sa',
  "vat_rate" = 0.15,
  "min_withdrawal_amount" = "min_withdrawal_amount_sar"
WHERE "id" = 'default';

INSERT INTO "platform_config" (
  "id",
  "market_id",
  "cashback_rate",
  "affiliate_pool_rate",
  "affiliate_level1_rate",
  "affiliate_level2_rate",
  "affiliate_level3_rate",
  "affiliate_level4_rate",
  "vendor_rate",
  "platform_rate",
  "min_withdrawal_amount_sar",
  "vat_rate",
  "min_withdrawal_amount",
  "return_window_days",
  "updated_at"
)
SELECT
  'config_market_om',
  'market_om',
  "cashback_rate",
  "affiliate_pool_rate",
  "affiliate_level1_rate",
  "affiliate_level2_rate",
  "affiliate_level3_rate",
  "affiliate_level4_rate",
  "vendor_rate",
  "platform_rate",
  "min_withdrawal_amount_sar",
  "vat_rate",
  "min_withdrawal_amount",
  "return_window_days",
  CURRENT_TIMESTAMP
FROM "platform_config"
WHERE "market_id" = 'market_sa'
  AND NOT EXISTS (SELECT 1 FROM "platform_config" WHERE "market_id" = 'market_om');

INSERT INTO "platform_config" (
  "id",
  "market_id",
  "cashback_rate",
  "affiliate_pool_rate",
  "affiliate_level1_rate",
  "affiliate_level2_rate",
  "affiliate_level3_rate",
  "affiliate_level4_rate",
  "vendor_rate",
  "platform_rate",
  "min_withdrawal_amount_sar",
  "vat_rate",
  "min_withdrawal_amount",
  "return_window_days",
  "updated_at"
)
SELECT
  'config_market_eg',
  'market_eg',
  "cashback_rate",
  "affiliate_pool_rate",
  "affiliate_level1_rate",
  "affiliate_level2_rate",
  "affiliate_level3_rate",
  "affiliate_level4_rate",
  "vendor_rate",
  "platform_rate",
  "min_withdrawal_amount_sar",
  "vat_rate",
  "min_withdrawal_amount",
  "return_window_days",
  CURRENT_TIMESTAMP
FROM "platform_config"
WHERE "market_id" = 'market_sa'
  AND NOT EXISTS (SELECT 1 FROM "platform_config" WHERE "market_id" = 'market_eg');

INSERT INTO "platform_config" (
  "id",
  "market_id",
  "cashback_rate",
  "affiliate_pool_rate",
  "affiliate_level1_rate",
  "affiliate_level2_rate",
  "affiliate_level3_rate",
  "affiliate_level4_rate",
  "vendor_rate",
  "platform_rate",
  "min_withdrawal_amount_sar",
  "vat_rate",
  "min_withdrawal_amount",
  "return_window_days",
  "updated_at"
)
SELECT
  'config_market_global',
  'market_global',
  "cashback_rate",
  "affiliate_pool_rate",
  "affiliate_level1_rate",
  "affiliate_level2_rate",
  "affiliate_level3_rate",
  "affiliate_level4_rate",
  "vendor_rate",
  "platform_rate",
  "min_withdrawal_amount_sar",
  "vat_rate",
  "min_withdrawal_amount",
  "return_window_days",
  CURRENT_TIMESTAMP
FROM "platform_config"
WHERE "market_id" = 'market_sa'
  AND NOT EXISTS (SELECT 1 FROM "platform_config" WHERE "market_id" = 'market_global');

UPDATE "platform_config" SET "id" = 'config_market_sa' WHERE "market_id" = 'market_sa';

ALTER TABLE "platform_config" DROP COLUMN "min_withdrawal_amount_sar";

ALTER TABLE "platform_config" ALTER COLUMN "market_id" SET NOT NULL;
ALTER TABLE "platform_config" ALTER COLUMN "vat_rate" SET NOT NULL;
ALTER TABLE "platform_config" ALTER COLUMN "min_withdrawal_amount" SET NOT NULL;

CREATE UNIQUE INDEX "platform_config_market_id_key" ON "platform_config"("market_id");

ALTER TABLE "platform_config"
  ADD CONSTRAINT "platform_config_market_id_fkey"
  FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
