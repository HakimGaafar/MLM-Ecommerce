-- CreateEnum
CREATE TYPE "ProductReviewTarget" AS ENUM ('NEW_PRODUCT', 'EDIT_REQUEST');

-- CreateEnum
CREATE TYPE "ProductEditRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "order_vendor_shipping" ALTER COLUMN "fulfillment_type" DROP DEFAULT;

-- AlterTable
ALTER TABLE "product_reviews" ADD COLUMN     "edit_request_id" TEXT,
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "target" "ProductReviewTarget" NOT NULL DEFAULT 'NEW_PRODUCT';

-- CreateTable
CREATE TABLE "product_edit_requests" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "status" "ProductEditRequestStatus" NOT NULL DEFAULT 'PENDING',
    "proposed_name" TEXT,
    "proposed_price" DECIMAL(18,2),
    "proposed_currency" TEXT,
    "proposed_category_id" TEXT,
    "proposed_fulfillment_type" "ProductFulfillmentType",
    "proposed_meta_title" VARCHAR(70),
    "proposed_meta_description" VARCHAR(160),
    "proposed_images_json" JSONB,
    "rejection_reason" TEXT,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_edit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_edit_requests_product_id_status_idx" ON "product_edit_requests"("product_id", "status");

-- CreateIndex
CREATE INDEX "product_edit_requests_vendor_id_status_idx" ON "product_edit_requests"("vendor_id", "status");

-- CreateIndex
CREATE INDEX "product_edit_requests_status_created_at_idx" ON "product_edit_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_edit_request_id_fkey" FOREIGN KEY ("edit_request_id") REFERENCES "product_edit_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_edit_requests" ADD CONSTRAINT "product_edit_requests_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_edit_requests" ADD CONSTRAINT "product_edit_requests_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_edit_requests" ADD CONSTRAINT "product_edit_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
