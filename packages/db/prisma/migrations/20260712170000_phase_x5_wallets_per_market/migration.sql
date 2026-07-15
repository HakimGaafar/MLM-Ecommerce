-- Phase X5: wallets per market (migrate existing → Saudi)

ALTER TABLE "wallets" ADD COLUMN "market_id" TEXT;

UPDATE "wallets" SET "market_id" = 'market_sa' WHERE "market_id" IS NULL;

ALTER TABLE "wallets" ALTER COLUMN "market_id" SET NOT NULL;

DROP INDEX IF EXISTS "wallets_user_id_key";

CREATE UNIQUE INDEX "wallets_user_id_market_id_key" ON "wallets"("user_id", "market_id");
CREATE INDEX "wallets_market_id_idx" ON "wallets"("market_id");

ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_market_id_fkey"
  FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wallet_transactions" ADD COLUMN "transfer_group_id" VARCHAR(64);
ALTER TABLE "wallet_transactions" ADD COLUMN "counterparty_wallet_id" TEXT;
