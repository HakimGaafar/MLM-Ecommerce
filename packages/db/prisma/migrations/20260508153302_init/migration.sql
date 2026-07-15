
-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "buyer_user_id" TEXT NOT NULL,
    "order_no" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "subtotal" DECIMAL(18,2) NOT NULL,
    "shipping_fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vat_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_no_key" ON "orders"("order_no");

-- CreateIndex
CREATE INDEX "orders_buyer_user_id_created_at_idx" ON "orders"("buyer_user_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_buyer_user_id_status_idx" ON "orders"("buyer_user_id", "status");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
