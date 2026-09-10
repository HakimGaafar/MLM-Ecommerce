-- Vendor business verification questionnaire + KYC description + admin-managed form lists.

ALTER TABLE "vendors"
  ADD COLUMN "has_commercial_license" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "license_type_code" VARCHAR(64),
  ADD COLUMN "license_type_other" VARCHAR(120),
  ADD COLUMN "ecommerce_on_license" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "kyc_documents"
  ADD COLUMN "description" TEXT;

CREATE TABLE "vendor_form_list_options" (
  "id" TEXT NOT NULL,
  "list_key" VARCHAR(64) NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "label_en" VARCHAR(200) NOT NULL,
  "label_ar" VARCHAR(200) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendor_form_list_options_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vendor_form_list_options_list_key_code_key"
  ON "vendor_form_list_options"("list_key", "code");

CREATE INDEX "vendor_form_list_options_list_key_is_active_sort_order_idx"
  ON "vendor_form_list_options"("list_key", "is_active", "sort_order");

INSERT INTO "vendor_form_list_options" ("id", "list_key", "code", "label_en", "label_ar", "sort_order", "is_active", "created_at", "updated_at")
VALUES
  ('vflo_license_shop', 'LICENSE_TYPE', 'SHOP_SHOWROOM', 'Shop or commercial showroom license', 'ترخيص محل أو معرض تجاري', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('vflo_license_home', 'LICENSE_TYPE', 'HOME_BUSINESS', 'Home business license', 'ترخيص عمل من البيت', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('vflo_license_other', 'LICENSE_TYPE', 'OTHER', 'Other (record details)', 'أخرى (سجل التفاصيل)', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
