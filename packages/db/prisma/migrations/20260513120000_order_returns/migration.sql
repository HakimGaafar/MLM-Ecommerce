-- CreateEnum
CREATE TYPE "OrderReturnReason" AS ENUM ('DONT_WANT', 'INCOMPLETE', 'WRONG_ITEM', 'COUNTERFEIT', 'DEFECTIVE', 'USED');

-- CreateEnum
CREATE TYPE "OrderReturnStatus" AS ENUM (
  'REQUESTED',
  'RECEIPT_IN_PROGRESS',
  'RECEIPT_COMPLETED',
  'PROCESSING_IN_PROGRESS',
  'PROCESSING_COMPLETED',
  'PROCESSING_REJECTED',
  'REFUND_IN_PROGRESS',
  'REFUND_COMPLETED',
  'CANCELLED_BY_CUSTOMER'
);

-- CreateTable
CREATE TABLE "order_returns" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "buyer_user_id" TEXT NOT NULL,
    "status" "OrderReturnStatus" NOT NULL DEFAULT 'REQUESTED'::"OrderReturnStatus",
    "reason" "OrderReturnReason" NOT NULL,
    "details" TEXT NOT NULL,
    "policy_accepted_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_returns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_returns_buyer_user_id_created_at_idx" ON "order_returns"("buyer_user_id", "created_at");

-- CreateIndex
CREATE INDEX "order_returns_order_id_idx" ON "order_returns"("order_id");

-- CreateIndex
CREATE INDEX "order_returns_status_idx" ON "order_returns"("status");

-- AddForeignKey
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
