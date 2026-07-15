-- Phase IV-e: order ops (stuck queue, escalations, notes, customer notices, vendor cancel)

CREATE TYPE "OrderFulfillmentEscalationLevel" AS ENUM ('REMINDER', 'WARNING', 'ESCALATION');
CREATE TYPE "OrderCustomerNoticeType" AS ENUM ('DELAY', 'GENERAL');
CREATE TYPE "OrderVendorCancellationStatus" AS ENUM ('COMPLETED', 'FAILED');

ALTER TABLE "vendors" ADD COLUMN "contact_phone" VARCHAR(32);

CREATE TABLE "order_admin_notes" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_admin_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_fulfillment_escalations" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "fulfillment_type" "ProductFulfillmentType",
    "level" "OrderFulfillmentEscalationLevel" NOT NULL,
    "message" VARCHAR(2000),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_fulfillment_escalations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_customer_notices" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "type" "OrderCustomerNoticeType" NOT NULL DEFAULT 'DELAY',
    "body" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_customer_notices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_vendor_cancellations" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "cancelled_subtotal" DECIMAL(18,2) NOT NULL,
    "cancelled_shipping" DECIMAL(18,2) NOT NULL,
    "cancelled_discount" DECIMAL(18,2) NOT NULL,
    "cancelled_vat" DECIMAL(18,2) NOT NULL,
    "refund_amount" DECIMAL(18,2) NOT NULL,
    "status" "OrderVendorCancellationStatus" NOT NULL DEFAULT 'COMPLETED',
    "failure_reason" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_vendor_cancellations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_admin_notes_order_id_created_at_idx" ON "order_admin_notes"("order_id", "created_at");
CREATE INDEX "order_fulfillment_escalations_order_id_created_at_idx" ON "order_fulfillment_escalations"("order_id", "created_at");
CREATE INDEX "order_fulfillment_escalations_vendor_id_created_at_idx" ON "order_fulfillment_escalations"("vendor_id", "created_at");
CREATE INDEX "order_fulfillment_escalations_order_id_vendor_id_fulfillment_type_idx" ON "order_fulfillment_escalations"("order_id", "vendor_id", "fulfillment_type");
CREATE INDEX "order_customer_notices_order_id_created_at_idx" ON "order_customer_notices"("order_id", "created_at");
CREATE UNIQUE INDEX "order_vendor_cancellations_order_id_vendor_id_key" ON "order_vendor_cancellations"("order_id", "vendor_id");
CREATE INDEX "order_vendor_cancellations_order_id_idx" ON "order_vendor_cancellations"("order_id");
CREATE INDEX "order_vendor_cancellations_vendor_id_idx" ON "order_vendor_cancellations"("vendor_id");

ALTER TABLE "order_admin_notes" ADD CONSTRAINT "order_admin_notes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_admin_notes" ADD CONSTRAINT "order_admin_notes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_fulfillment_escalations" ADD CONSTRAINT "order_fulfillment_escalations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_fulfillment_escalations" ADD CONSTRAINT "order_fulfillment_escalations_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_fulfillment_escalations" ADD CONSTRAINT "order_fulfillment_escalations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_customer_notices" ADD CONSTRAINT "order_customer_notices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_customer_notices" ADD CONSTRAINT "order_customer_notices_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_vendor_cancellations" ADD CONSTRAINT "order_vendor_cancellations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_vendor_cancellations" ADD CONSTRAINT "order_vendor_cancellations_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_vendor_cancellations" ADD CONSTRAINT "order_vendor_cancellations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
