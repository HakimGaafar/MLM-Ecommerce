-- Phase 5: PLATFORM_SALE / MERCHANT_SUPPLY invoice types + per-order vendor invoicing snapshot.

DO $$ BEGIN
  ALTER TYPE "InvoiceDocumentType" ADD VALUE 'PLATFORM_SALE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "InvoiceDocumentType" ADD VALUE 'MERCHANT_SUPPLY';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "order_vendor_invoicing" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "vendor_id" TEXT NOT NULL,
  "seller_market_id" TEXT NOT NULL,
  "buyer_market_id" TEXT NOT NULL,
  "invoicing_party" "InvoicingParty" NOT NULL,
  "commission_rate" DECIMAL(8, 6) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_vendor_invoicing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "order_vendor_invoicing_order_id_vendor_id_key"
  ON "order_vendor_invoicing"("order_id", "vendor_id");
CREATE INDEX IF NOT EXISTS "order_vendor_invoicing_vendor_id_idx"
  ON "order_vendor_invoicing"("vendor_id");
CREATE INDEX IF NOT EXISTS "order_vendor_invoicing_order_id_invoicing_party_idx"
  ON "order_vendor_invoicing"("order_id", "invoicing_party");

DO $$ BEGIN
  ALTER TABLE "order_vendor_invoicing"
    ADD CONSTRAINT "order_vendor_invoicing_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "order_vendor_invoicing"
    ADD CONSTRAINT "order_vendor_invoicing_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
