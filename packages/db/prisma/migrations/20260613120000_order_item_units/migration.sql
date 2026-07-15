-- Phase II: per-unit order lines, partial returns, final invoice flag
CREATE TYPE "OrderUnitStatus" AS ENUM ('ACTIVE', 'RETURN_REQUESTED', 'RETURNED', 'CANCELLED');

ALTER TABLE "orders" ADD COLUMN "final_invoice_allowed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "order_items" ADD COLUMN "unit_index" INTEGER;
ALTER TABLE "order_items" ADD COLUMN "unit_label" VARCHAR(64);
ALTER TABLE "order_items" ADD COLUMN "unit_status" "OrderUnitStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "order_items" ADD COLUMN "order_return_id" TEXT;

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_return_id_fkey"
  FOREIGN KEY ("order_return_id") REFERENCES "order_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "order_items_order_return_id_idx" ON "order_items"("order_return_id");
CREATE INDEX "order_items_order_id_unit_status_idx" ON "order_items"("order_id", "unit_status");
