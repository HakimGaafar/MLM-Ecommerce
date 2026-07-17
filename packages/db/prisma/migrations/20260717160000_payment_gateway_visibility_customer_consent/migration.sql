ALTER TABLE "customer_profiles"
  ADD COLUMN "international_shopping_notice_accepted_at" TIMESTAMP(3),
  ADD COLUMN "international_shopping_notice_version" VARCHAR(32);

ALTER TABLE "platform_config"
  ADD COLUMN "show_tap_gateway" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "show_hyperpay_gateway" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "show_myfatoorah_gateway" BOOLEAN NOT NULL DEFAULT true;
