-- Phase XII2: composite indexes for stuck orders, settlements, vendor metrics, product search

CREATE INDEX IF NOT EXISTS "orders_market_id_status_idx"
  ON "orders" ("market_id", "status");

CREATE INDEX IF NOT EXISTS "wallet_transactions_status_entry_type_created_at_idx"
  ON "wallet_transactions" ("status", "entry_type", "created_at");

CREATE INDEX IF NOT EXISTS "wallet_transactions_user_id_entry_type_status_idx"
  ON "wallet_transactions" ("user_id", "entry_type", "status");

CREATE INDEX IF NOT EXISTS "order_vendor_shipping_vendor_id_fulfillment_status_idx"
  ON "order_vendor_shipping" ("vendor_id", "fulfillment_status");

CREATE INDEX IF NOT EXISTS "order_vendor_shipping_stuck_filter_idx"
  ON "order_vendor_shipping" ("fulfillment_status", "fulfillment_updated_at");

-- Optional trigram search (safe if extension unavailable on host — ignore failure in migrate deploy)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
  WHEN undefined_file THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "products_name_trgm_idx"
  ON "products" USING gin ("name" gin_trgm_ops);
