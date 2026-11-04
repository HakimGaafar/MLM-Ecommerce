-- Phase 7 catalog depth: product slugs, category tree, variants/SKU.

-- Categories: parent/child
ALTER TABLE "product_categories" ADD COLUMN IF NOT EXISTS "parent_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "product_categories"
    ADD CONSTRAINT "product_categories_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "product_categories_parent_id_idx"
  ON "product_categories"("parent_id");

-- Products: public slug (backfill from name / id)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(80);

UPDATE "products"
SET "slug" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(NULLIF(TRIM("name"), ''), "id"), '[^a-zA-Z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g'))
WHERE "slug" IS NULL OR TRIM("slug") = '';

UPDATE "products"
SET "slug" = LEFT("id", 80)
WHERE "slug" IS NULL OR TRIM("slug") = '';

-- Deduplicate slugs within a market
WITH ranked AS (
  SELECT id,
         slug,
         market_id,
         ROW_NUMBER() OVER (PARTITION BY market_id, slug ORDER BY created_at, id) AS rn
  FROM products
)
UPDATE products p
SET slug = LEFT(p.slug || '-' || SUBSTRING(p.id FROM 1 FOR 6), 80)
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

ALTER TABLE "products" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "products_market_id_slug_key"
  ON "products"("market_id", "slug");

-- Variants
CREATE TABLE IF NOT EXISTS "product_variants" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "sku" VARCHAR(64),
  "title" VARCHAR(200) NOT NULL,
  "options_json" JSONB NOT NULL DEFAULT '{}',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "product_variants_product_id_sort_order_idx"
  ON "product_variants"("product_id", "sort_order");
CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_product_id_sku_key"
  ON "product_variants"("product_id", "sku");

DO $$ BEGIN
  ALTER TABLE "product_variants"
    ADD CONSTRAINT "product_variants_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "product_variant_offers" (
  "id" TEXT NOT NULL,
  "variant_id" TEXT NOT NULL,
  "market_id" TEXT NOT NULL,
  "price" DECIMAL(18, 2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_variant_offers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_variant_offers_variant_id_market_id_key"
  ON "product_variant_offers"("variant_id", "market_id");
CREATE INDEX IF NOT EXISTS "product_variant_offers_market_id_idx"
  ON "product_variant_offers"("market_id");

DO $$ BEGIN
  ALTER TABLE "product_variant_offers"
    ADD CONSTRAINT "product_variant_offers_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "product_variant_offers"
    ADD CONSTRAINT "product_variant_offers_market_id_fkey"
    FOREIGN KEY ("market_id") REFERENCES "markets"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Cart: variant-aware uniqueness
ALTER TABLE "cart_items" ADD COLUMN IF NOT EXISTS "variant_id" TEXT;
ALTER TABLE "cart_items" ADD COLUMN IF NOT EXISTS "variant_key" VARCHAR(64) NOT NULL DEFAULT '';

UPDATE "cart_items" SET "variant_key" = COALESCE("variant_id", '') WHERE "variant_key" IS NULL OR "variant_key" = '';

DO $$ BEGIN
  ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_cart_id_product_id_key";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DROP INDEX IF EXISTS "cart_items_cart_id_product_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_cart_id_product_id_variant_key_key"
  ON "cart_items"("cart_id", "product_id", "variant_key");

CREATE INDEX IF NOT EXISTS "cart_items_variant_id_idx" ON "cart_items"("variant_id");

DO $$ BEGIN
  ALTER TABLE "cart_items"
    ADD CONSTRAINT "cart_items_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Order lines: variant snapshots
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "variant_id" TEXT;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "variant_title_snapshot" VARCHAR(200);
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "variant_sku_snapshot" VARCHAR(64);

DO $$ BEGIN
  ALTER TABLE "order_items"
    ADD CONSTRAINT "order_items_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
