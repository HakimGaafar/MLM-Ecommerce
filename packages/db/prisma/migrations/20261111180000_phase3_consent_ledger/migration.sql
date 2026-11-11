-- Phase 3: immutable consent ledger for signup / checkout / vendor onboarding.

DO $$ BEGIN
  CREATE TYPE "ConsentContext" AS ENUM (
    'CUSTOMER_SIGNUP',
    'CUSTOMER_CHECKOUT',
    'VENDOR_ONBOARDING',
    'MARKET_REACCEPT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "consent_records" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "market_id" TEXT NOT NULL,
  "document_type" "LegalDocumentType" NOT NULL,
  "policy_version" VARCHAR(32) NOT NULL,
  "context" "ConsentContext" NOT NULL,
  "vendor_id" TEXT,
  "order_id" TEXT,
  "ip_address" VARCHAR(64),
  "user_agent" VARCHAR(512),
  "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "consent_records_user_id_context_accepted_at_idx"
  ON "consent_records"("user_id", "context", "accepted_at");
CREATE INDEX IF NOT EXISTS "consent_records_market_id_document_type_accepted_at_idx"
  ON "consent_records"("market_id", "document_type", "accepted_at");
CREATE INDEX IF NOT EXISTS "consent_records_vendor_id_accepted_at_idx"
  ON "consent_records"("vendor_id", "accepted_at");
CREATE INDEX IF NOT EXISTS "consent_records_order_id_idx"
  ON "consent_records"("order_id");

DO $$ BEGIN
  ALTER TABLE "consent_records"
    ADD CONSTRAINT "consent_records_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "consent_records"
    ADD CONSTRAINT "consent_records_market_id_fkey"
    FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
