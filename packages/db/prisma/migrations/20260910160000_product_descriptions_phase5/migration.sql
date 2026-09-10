-- Phase 5: bilingual product descriptions + edit-request proposals.

ALTER TABLE "products"
  ADD COLUMN "description_en" TEXT,
  ADD COLUMN "description_ar" TEXT;

ALTER TABLE "product_edit_requests"
  ADD COLUMN "proposed_description_en" TEXT,
  ADD COLUMN "proposed_description_ar" TEXT;
