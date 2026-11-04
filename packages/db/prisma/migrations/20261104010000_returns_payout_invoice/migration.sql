-- Returns hub + round-trip cost finals + payout purchase invoices + settlement risk consents

DO $$ BEGIN
  ALTER TYPE "OrderReturnReason" ADD VALUE 'DAMAGED_IN_TRANSIT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReturnGoodsDisposition" AS ENUM ('HOLD_AT_HUB', 'RETURN_TO_VENDOR', 'DISPOSE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VendorPayoutInvoiceStatus" AS ENUM ('PENDING_REVIEW', 'ACCEPTED', 'NEEDS_FIX');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "order_returns"
  ADD COLUMN IF NOT EXISTS "return_cost_final_fee" DECIMAL(18, 2),
  ADD COLUMN IF NOT EXISTS "return_cost_bearer_final" "ReturnCostBearer",
  ADD COLUMN IF NOT EXISTS "hub_inspection_required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "hub_received_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "hub_inspected_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "hub_inspected_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "hub_inspection_note" VARCHAR(2000),
  ADD COLUMN IF NOT EXISTS "goods_disposition" "ReturnGoodsDisposition" NOT NULL DEFAULT 'HOLD_AT_HUB';

DO $$ BEGIN
  ALTER TABLE "order_returns"
    ADD CONSTRAINT "order_returns_hub_inspected_by_user_id_fkey"
    FOREIGN KEY ("hub_inspected_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "settlement_risk_accepted_at" TIMESTAMP(3);

ALTER TABLE "vendors"
  ADD COLUMN IF NOT EXISTS "settlement_risk_consent_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "vendor_payout_invoices" (
  "id" TEXT NOT NULL,
  "market_id" TEXT NOT NULL,
  "vendor_id" TEXT NOT NULL,
  "uploaded_by_user_id" TEXT NOT NULL,
  "withdrawal_transaction_id" TEXT NOT NULL,
  "amount_received" DECIMAL(18, 2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "order_nos_text" VARCHAR(2000) NOT NULL,
  "file_storage_key" VARCHAR(500) NOT NULL,
  "file_original_name" VARCHAR(255),
  "status" "VendorPayoutInvoiceStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "review_note" VARCHAR(2000),
  "reviewed_by_user_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendor_payout_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "vendor_payout_invoices_withdrawal_transaction_id_key"
  ON "vendor_payout_invoices"("withdrawal_transaction_id");
CREATE INDEX IF NOT EXISTS "vendor_payout_invoices_market_id_status_created_at_idx"
  ON "vendor_payout_invoices"("market_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "vendor_payout_invoices_vendor_id_created_at_idx"
  ON "vendor_payout_invoices"("vendor_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "vendor_payout_invoices"
    ADD CONSTRAINT "vendor_payout_invoices_market_id_fkey"
    FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "vendor_payout_invoices"
    ADD CONSTRAINT "vendor_payout_invoices_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "vendor_payout_invoices"
    ADD CONSTRAINT "vendor_payout_invoices_uploaded_by_user_id_fkey"
    FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "vendor_payout_invoices"
    ADD CONSTRAINT "vendor_payout_invoices_reviewed_by_user_id_fkey"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "vendor_payout_invoices"
    ADD CONSTRAINT "vendor_payout_invoices_withdrawal_transaction_id_fkey"
    FOREIGN KEY ("withdrawal_transaction_id") REFERENCES "wallet_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
