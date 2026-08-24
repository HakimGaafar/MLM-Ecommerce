-- Admin platform control: per-market shipping rates, platform MLM/settlement settings, config audit log

CREATE TYPE "MissingAncestorPolicy" AS ENUM ('KEEP_BY_PLATFORM', 'REDISTRIBUTE_TO_EXISTING_LEVELS');

ALTER TABLE "platform_config"
  ADD COLUMN "settlement_window_days" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN "referral_depth_max" INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN "missing_ancestor_policy" "MissingAncestorPolicy" NOT NULL DEFAULT 'KEEP_BY_PLATFORM';

CREATE TABLE "platform_config_change_logs" (
  "id" TEXT NOT NULL,
  "market_id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "summary" VARCHAR(500) NOT NULL,
  "changes_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_config_change_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_config_change_logs_market_id_created_at_idx"
  ON "platform_config_change_logs"("market_id", "created_at");

ALTER TABLE "platform_config_change_logs"
  ADD CONSTRAINT "platform_config_change_logs_market_id_fkey"
  FOREIGN KEY ("market_id") REFERENCES "platform_config"("market_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Per-market shipping rates
ALTER TABLE "shipping_rates" ADD COLUMN "market_id" TEXT;

UPDATE "shipping_rates" SET "market_id" = 'market_sa' WHERE "market_id" IS NULL;

ALTER TABLE "shipping_rates" ALTER COLUMN "market_id" SET NOT NULL;

DROP INDEX IF EXISTS "shipping_rates_code_key";

CREATE UNIQUE INDEX "shipping_rates_market_id_code_key" ON "shipping_rates"("market_id", "code");

DROP INDEX IF EXISTS "shipping_rates_package_type_fources_mode_is_active_idx";

CREATE INDEX "shipping_rates_market_id_package_type_fources_mode_is_active_idx"
  ON "shipping_rates"("market_id", "package_type", "fources_mode", "is_active");

ALTER TABLE "shipping_rates"
  ADD CONSTRAINT "shipping_rates_market_id_fkey"
  FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed checkout rates for OM, EG, GLOBAL (same amounts, market currency)
INSERT INTO "shipping_rates" ("id", "market_id", "code", "package_type", "fources_mode", "amount", "currency", "per_unit", "is_active", "created_at", "updated_at")
SELECT
  'shiprate_' || lower(m.code) || '_' ||
    CASE sr.code
      WHEN 'MERCHANT_DOMESTIC' THEN 'md'
      WHEN 'MERCHANT_INTERNATIONAL' THEN 'mi'
      WHEN 'FOURCES_DOMESTIC_STOCK' THEN 'fds'
      WHEN 'FOURCES_DOMESTIC_ON_ORDER' THEN 'fdo'
      WHEN 'FOURCES_INTERNATIONAL_STOCK' THEN 'fis'
      WHEN 'FOURCES_INTERNATIONAL_ON_ORDER' THEN 'fio'
      ELSE lower(sr.code)
    END,
  m.id,
  sr.code,
  sr.package_type,
  sr.fources_mode,
  sr.amount,
  m.default_currency,
  sr.per_unit,
  sr.is_active,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "shipping_rates" sr
CROSS JOIN "markets" m
WHERE sr.market_id = 'market_sa'
  AND m.id <> 'market_sa'
ON CONFLICT DO NOTHING;
