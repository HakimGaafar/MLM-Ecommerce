-- Phase 4: dual commission rates + commission debt ledger entry type + shipping invoice type + FX rates

ALTER TABLE "platform_config"
  ADD COLUMN IF NOT EXISTS "platform_rate_cross" DECIMAL(8,6) NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS "vendor_rate_cross" DECIMAL(8,6) NOT NULL DEFAULT 0.90;

-- Backfill from existing home rates if somehow null (defaults already set)
UPDATE "platform_config"
SET "platform_rate_cross" = 0.10
WHERE "platform_rate_cross" IS NULL;

UPDATE "platform_config"
SET "vendor_rate_cross" = 0.90
WHERE "vendor_rate_cross" IS NULL;

DO $$ BEGIN ALTER TYPE "WalletEntryType" ADD VALUE 'COMMISSION_DEBT'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "WalletEntryType" ADD VALUE 'COMMISSION_DEBT_CLEAR'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "InvoiceDocumentType" ADD VALUE 'SHIPPING'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "fx_rates" (
  "id" TEXT NOT NULL,
  "from_currency" CHAR(3) NOT NULL,
  "to_currency" CHAR(3) NOT NULL,
  "rate" DECIMAL(18,8) NOT NULL,
  "source" VARCHAR(64) NOT NULL DEFAULT 'MANUAL',
  "effective_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fx_rates_from_to_effective_uidx"
  ON "fx_rates" ("from_currency", "to_currency", "effective_at");

CREATE INDEX IF NOT EXISTS "fx_rates_pair_idx"
  ON "fx_rates" ("from_currency", "to_currency", "effective_at" DESC);
