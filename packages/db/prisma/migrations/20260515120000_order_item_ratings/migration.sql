-- CreateTable
CREATE TABLE "order_item_ratings" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "buyer_user_id" TEXT NOT NULL,
    "product_stars" INTEGER NOT NULL,
    "vendor_stars" INTEGER NOT NULL,
    "delivery_stars" INTEGER NOT NULL,
    "comment" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_item_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_item_ratings_order_item_id_key" ON "order_item_ratings"("order_item_id");

-- CreateIndex
CREATE INDEX "order_item_ratings_buyer_user_id_created_at_idx" ON "order_item_ratings"("buyer_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "order_item_ratings" ADD CONSTRAINT "order_item_ratings_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_ratings" ADD CONSTRAINT "order_item_ratings_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
