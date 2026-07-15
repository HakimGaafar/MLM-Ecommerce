-- Phase X6: storefront banners + vendor per market (owner + market unique)

CREATE TABLE "market_banners" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "title_en" VARCHAR(200) NOT NULL,
    "title_ar" VARCHAR(200) NOT NULL,
    "subtitle_en" VARCHAR(500),
    "subtitle_ar" VARCHAR(500),
    "image_url" VARCHAR(500),
    "link_url" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_banners_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "market_banners_market_id_is_active_sort_order_idx" ON "market_banners"("market_id", "is_active", "sort_order");

ALTER TABLE "market_banners" ADD CONSTRAINT "market_banners_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "vendors_owner_user_id_market_id_key" ON "vendors"("owner_user_id", "market_id");
