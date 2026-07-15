-- AlterEnum
ALTER TYPE "ProductStatus" ADD VALUE 'REJECTED';

-- CreateEnum
CREATE TYPE "ProductReviewAction" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "product_reviews" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "action" "ProductReviewAction" NOT NULL,
    "reviewed_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_reviews_product_id_idx" ON "product_reviews"("product_id");

-- CreateIndex
CREATE INDEX "product_reviews_action_created_at_idx" ON "product_reviews"("action", "created_at");

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
