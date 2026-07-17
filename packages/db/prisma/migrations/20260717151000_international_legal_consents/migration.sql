ALTER TABLE "vendors"
  ADD COLUMN "international_sales_consent_at" TIMESTAMP(3),
  ADD COLUMN "international_sales_consent_version" VARCHAR(32);

ALTER TABLE "affiliate_profiles"
  ADD COLUMN "international_marketing_consent_at" TIMESTAMP(3),
  ADD COLUMN "international_marketing_consent_version" VARCHAR(32);
