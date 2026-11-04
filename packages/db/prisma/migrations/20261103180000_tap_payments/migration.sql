-- AlterTable
ALTER TABLE "orders" ADD COLUMN "tap_charge_id" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "orders_tap_charge_id_key" ON "orders"("tap_charge_id");

-- CreateTable
CREATE TABLE "tap_webhook_events" (
    "id" VARCHAR(255) NOT NULL,
    "type" VARCHAR(128) NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tap_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tap_webhook_events_processed_at_idx" ON "tap_webhook_events"("processed_at");
