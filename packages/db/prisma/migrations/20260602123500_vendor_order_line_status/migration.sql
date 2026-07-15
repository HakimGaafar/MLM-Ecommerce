ALTER TABLE "order_items"
ADD COLUMN "vendor_fulfillment_status" "OrderStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN "vendor_fulfillment_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "order_items_order_id_vendor_id_vendor_fulfillment_status_idx"
ON "order_items"("order_id", "vendor_id", "vendor_fulfillment_status");
