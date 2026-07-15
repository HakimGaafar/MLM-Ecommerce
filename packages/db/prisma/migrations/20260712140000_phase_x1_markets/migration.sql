-- Phase X1: markets table (routing only; tenancy in X2)

CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "subdomain" VARCHAR(32) NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "default_currency" CHAR(3) NOT NULL,
    "geo_country_codes" TEXT[] NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "markets_code_key" ON "markets"("code");
CREATE UNIQUE INDEX "markets_subdomain_key" ON "markets"("subdomain");

INSERT INTO "markets" (
    "id",
    "code",
    "subdomain",
    "name_en",
    "name_ar",
    "default_currency",
    "geo_country_codes",
    "is_active",
    "sort_order",
    "updated_at"
) VALUES
    ('market_sa', 'SA', 'sa', 'Saudi Arabia', 'السعودية', 'SAR', ARRAY['SA']::TEXT[], true, 1, CURRENT_TIMESTAMP),
    ('market_om', 'OM', 'om', 'Oman', 'عُمان', 'OMR', ARRAY['OM']::TEXT[], true, 2, CURRENT_TIMESTAMP),
    ('market_eg', 'EG', 'eg', 'Egypt', 'مصر', 'EGP', ARRAY['EG']::TEXT[], true, 3, CURRENT_TIMESTAMP),
    ('market_global', 'GLOBAL', 'global', 'Global', 'عالمي', 'USD', ARRAY[]::TEXT[], true, 4, CURRENT_TIMESTAMP);
