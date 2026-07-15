-- AlterTable
ALTER TABLE "orders" ADD COLUMN "stripe_checkout_session_id" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "orders_stripe_checkout_session_id_key" ON "orders"("stripe_checkout_session_id");
