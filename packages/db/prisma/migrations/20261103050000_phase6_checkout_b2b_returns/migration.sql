-- Phase 6: B2B order fields + N-051 return cost snapshot.

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "buying_for_company" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "company_name" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "company_tax_id" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "company_cr_number" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "company_hq_address_line_1" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "company_hq_city" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "company_hq_country_code" CHAR(2);

DO $$ BEGIN
  CREATE TYPE "ReturnCostZone" AS ENUM ('SAME_CITY', 'SAME_COUNTRY', 'CROSS_BORDER', 'UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReturnCostBearer" AS ENUM ('CUSTOMER', 'VENDOR', 'PLATFORM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "order_returns"
  ADD COLUMN IF NOT EXISTS "return_shipping_fee" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "return_cost_zone" "ReturnCostZone" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS "return_cost_bearer" "ReturnCostBearer" NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN IF NOT EXISTS "return_cost_currency" CHAR(3) NOT NULL DEFAULT 'SAR',
  ADD COLUMN IF NOT EXISTS "return_cost_note" VARCHAR(500);
