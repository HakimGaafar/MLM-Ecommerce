-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- Seed default categories
INSERT INTO "product_categories" ("id", "slug", "name_en", "name_ar", "sort_order", "is_active") VALUES
  ('cat_electronics', 'electronics', 'Electronics', 'إلكترونيات', 1, true),
  ('cat_fashion', 'fashion', 'Fashion', 'أزياء', 2, true),
  ('cat_home', 'home', 'Home & Living', 'منزل ومعيشة', 3, true),
  ('cat_health', 'health', 'Health', 'صحة', 4, true),
  ('cat_beauty', 'beauty', 'Beauty', 'تجميل', 5, true),
  ('cat_general', 'general', 'General', 'عام', 99, true);

-- Add category column (nullable first for backfill)
ALTER TABLE "products" ADD COLUMN "category_id" TEXT;

UPDATE "products" SET "category_id" = 'cat_general' WHERE "category_id" IS NULL;

ALTER TABLE "products" ALTER COLUMN "category_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories"("slug");

CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");

CREATE INDEX "products_category_id_idx" ON "products"("category_id");

CREATE INDEX "products_status_category_id_idx" ON "products"("status", "category_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
