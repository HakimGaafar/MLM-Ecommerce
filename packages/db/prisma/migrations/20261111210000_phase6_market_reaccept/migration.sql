-- Phase 6: pending market re-accept flag after a closed home market opens.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "pending_market_reaccept_id" TEXT,
  ADD COLUMN IF NOT EXISTS "pending_market_reaccept_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "users_pending_market_reaccept_id_idx"
  ON "users"("pending_market_reaccept_id");

DO $$ BEGIN
  ALTER TABLE "users"
    ADD CONSTRAINT "users_pending_market_reaccept_id_fkey"
    FOREIGN KEY ("pending_market_reaccept_id") REFERENCES "markets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
