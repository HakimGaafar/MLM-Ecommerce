-- Phase 1 legal foundations: market annex fields, payment currencies,
-- policy versions, invoicing-party rules, refund-fee allocation table.

-- Market payment currencies
ALTER TABLE "markets" ADD COLUMN IF NOT EXISTS "payment_currencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Market annex fields on invoice issuer
ALTER TABLE "market_invoice_issuers" ADD COLUMN IF NOT EXISTS "commercial_registration" VARCHAR(64);
ALTER TABLE "market_invoice_issuers" ADD COLUMN IF NOT EXISTS "unified_number" VARCHAR(64);
ALTER TABLE "market_invoice_issuers" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(32);
ALTER TABLE "market_invoice_issuers" ADD COLUMN IF NOT EXISTS "email" VARCHAR(254);
ALTER TABLE "market_invoice_issuers" ADD COLUMN IF NOT EXISTS "consumer_protection_authority_en" VARCHAR(300);
ALTER TABLE "market_invoice_issuers" ADD COLUMN IF NOT EXISTS "consumer_protection_authority_ar" VARCHAR(300);

-- Enums
DO $$ BEGIN
  CREATE TYPE "LegalDocumentType" AS ENUM (
    'ABOUT',
    'TERMS',
    'PRIVACY',
    'RETURNS',
    'SHIPPING',
    'PRICING_PAYMENT',
    'CASHBACK_REFERRAL',
    'MERCHANT_COOPERATION',
    'MERCHANT_OPERATIONAL',
    'MERCHANT_COMMISSION',
    'MERCHANT_DATA_CONFIRMATION'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InvoicingParty" AS ENUM ('MERCHANT', 'PLATFORM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RefundFeeCause" AS ENUM (
    'PRODUCT_DEFECT',
    'MERCHANT_MISTAKE',
    'PLATFORM_MISTAKE',
    'CUSTOMER_CHANGE_OF_MIND',
    'CUSTOMER_REFUSED_DELIVERY'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RefundFeePayer" AS ENUM ('MERCHANT', 'PLATFORM', 'CUSTOMER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Legal policy versions
CREATE TABLE IF NOT EXISTS "legal_policy_versions" (
  "id" TEXT NOT NULL,
  "market_id" TEXT NOT NULL,
  "document_type" "LegalDocumentType" NOT NULL,
  "version" VARCHAR(32) NOT NULL,
  "title_en" VARCHAR(200) NOT NULL,
  "title_ar" VARCHAR(200) NOT NULL,
  "body_en" TEXT,
  "body_ar" TEXT,
  "published_at" TIMESTAMP(3),
  "is_current" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "legal_policy_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "legal_policy_versions_market_id_document_type_version_key"
  ON "legal_policy_versions"("market_id", "document_type", "version");
CREATE INDEX IF NOT EXISTS "legal_policy_versions_market_id_document_type_is_current_idx"
  ON "legal_policy_versions"("market_id", "document_type", "is_current");
CREATE INDEX IF NOT EXISTS "legal_policy_versions_market_id_document_type_published_at_idx"
  ON "legal_policy_versions"("market_id", "document_type", "published_at");

DO $$ BEGIN
  ALTER TABLE "legal_policy_versions"
    ADD CONSTRAINT "legal_policy_versions_market_id_fkey"
    FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Market invoicing rules
CREATE TABLE IF NOT EXISTS "market_invoicing_rules" (
  "id" TEXT NOT NULL,
  "seller_market_id" TEXT NOT NULL,
  "buyer_market_id" TEXT NOT NULL,
  "invoicing_party" "InvoicingParty" NOT NULL,
  "commission_rate" DECIMAL(8,6),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "market_invoicing_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "market_invoicing_rules_seller_market_id_buyer_market_id_key"
  ON "market_invoicing_rules"("seller_market_id", "buyer_market_id");
CREATE INDEX IF NOT EXISTS "market_invoicing_rules_buyer_market_id_idx"
  ON "market_invoicing_rules"("buyer_market_id");

DO $$ BEGIN
  ALTER TABLE "market_invoicing_rules"
    ADD CONSTRAINT "market_invoicing_rules_seller_market_id_fkey"
    FOREIGN KEY ("seller_market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "market_invoicing_rules"
    ADD CONSTRAINT "market_invoicing_rules_buyer_market_id_fkey"
    FOREIGN KEY ("buyer_market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Refund fee rules
CREATE TABLE IF NOT EXISTS "refund_fee_rules" (
  "id" TEXT NOT NULL,
  "market_id" TEXT NOT NULL,
  "cause" "RefundFeeCause" NOT NULL,
  "payer" "RefundFeePayer" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "refund_fee_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "refund_fee_rules_market_id_cause_key"
  ON "refund_fee_rules"("market_id", "cause");

DO $$ BEGIN
  ALTER TABLE "refund_fee_rules"
    ADD CONSTRAINT "refund_fee_rules_market_id_fkey"
    FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Launch visibility: Egypt closed/hidden; others open
UPDATE "markets" SET "is_active" = false WHERE "code" = 'EG';
UPDATE "markets" SET "is_active" = true WHERE "code" IN ('OM', 'SA', 'GLOBAL');

-- Payment currencies defaults
UPDATE "markets" SET "payment_currencies" = ARRAY['SAR']::TEXT[] WHERE "code" = 'SA';
UPDATE "markets" SET "payment_currencies" = ARRAY['OMR']::TEXT[] WHERE "code" = 'OM';
UPDATE "markets" SET "payment_currencies" = ARRAY['EGP']::TEXT[] WHERE "code" = 'EG';
UPDATE "markets"
  SET "payment_currencies" = ARRAY['OMR','USD']::TEXT[],
      "default_currency" = 'OMR',
      "name_en" = 'International'
  WHERE "code" = 'GLOBAL';
