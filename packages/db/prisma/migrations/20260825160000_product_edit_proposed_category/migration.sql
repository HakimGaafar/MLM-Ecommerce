-- Product edit requests: proposed category (schema parity for fresh deploys).
ALTER TABLE "product_edit_requests"
  ADD COLUMN IF NOT EXISTS "proposed_category_id" TEXT;
