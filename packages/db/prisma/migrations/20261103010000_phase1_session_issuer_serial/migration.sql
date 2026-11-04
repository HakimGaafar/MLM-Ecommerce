-- Phase 1: session timeout, COD switch, invoice serial counters, market issuers

ALTER TABLE "platform_config" ADD COLUMN IF NOT EXISTS "session_access_minutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "platform_config" ADD COLUMN IF NOT EXISTS "cod_enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "invoice_serial_counters" (
    "id" TEXT NOT NULL,
    "issuer_key" VARCHAR(64) NOT NULL,
    "prefix" VARCHAR(24) NOT NULL,
    "next_value" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invoice_serial_counters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoice_serial_counters_issuer_key_key" ON "invoice_serial_counters"("issuer_key");

CREATE TABLE IF NOT EXISTS "market_invoice_issuers" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "legal_name_en" VARCHAR(200) NOT NULL,
    "legal_name_ar" VARCHAR(200) NOT NULL,
    "address_line_1" VARCHAR(200) NOT NULL,
    "address_line_2" VARCHAR(200),
    "city" VARCHAR(100) NOT NULL,
    "postal_code" VARCHAR(32),
    "country_code" CHAR(2) NOT NULL,
    "vat_registered" BOOLEAN NOT NULL DEFAULT true,
    "vat_trn" VARCHAR(64),
    "vat_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "logo_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "market_invoice_issuers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "market_invoice_issuers_market_id_key" ON "market_invoice_issuers"("market_id");

DO $$ BEGIN
  ALTER TABLE "market_invoice_issuers" ADD CONSTRAINT "market_invoice_issuers_market_id_fkey"
    FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
