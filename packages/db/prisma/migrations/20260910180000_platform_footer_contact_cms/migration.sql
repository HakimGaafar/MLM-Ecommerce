-- Phase 7: footer / contact CMS fields on platform_config.

ALTER TABLE "platform_config"
  ADD COLUMN "footer_tagline_en" TEXT,
  ADD COLUMN "footer_tagline_ar" TEXT,
  ADD COLUMN "contact_location_en" TEXT,
  ADD COLUMN "contact_location_ar" TEXT,
  ADD COLUMN "public_contact_email" VARCHAR(254),
  ADD COLUMN "inquiry_notify_email" VARCHAR(254);
