-- Extend vendors for public storefront + seller onboarding (Phase C).
-- Existing rows get a slug derived from id; adjust in admin if needed.

ALTER TABLE "vendors" ADD COLUMN "slug" VARCHAR(64);
ALTER TABLE "vendors" ADD COLUMN "country_code" CHAR(2) NOT NULL DEFAULT 'SA';
ALTER TABLE "vendors" ADD COLUMN "address_line_1" VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE "vendors" ADD COLUMN "address_line_2" VARCHAR(200);
ALTER TABLE "vendors" ADD COLUMN "state" VARCHAR(120);
ALTER TABLE "vendors" ADD COLUMN "city" VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE "vendors" ADD COLUMN "postal_code" VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE "vendors" ADD COLUMN "about" TEXT;
ALTER TABLE "vendors" ADD COLUMN "logo_url" VARCHAR(500);
ALTER TABLE "vendors" ADD COLUMN "banner_url" VARCHAR(500);
ALTER TABLE "vendors" ADD COLUMN "plan_code" VARCHAR(32) NOT NULL DEFAULT 'FREE';

UPDATE "vendors"
SET "slug" = 'store-' || LOWER(SUBSTRING("id" FROM 1 FOR 12))
WHERE "slug" IS NULL;

ALTER TABLE "vendors" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "vendors_slug_key" ON "vendors"("slug");

-- Required columns without server defaults (matches Prisma schema).
ALTER TABLE "vendors" ALTER COLUMN "address_line_1" DROP DEFAULT,
ALTER COLUMN "city" DROP DEFAULT,
ALTER COLUMN "postal_code" DROP DEFAULT;
