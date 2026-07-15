-- Customer profile: optional alternate shipping address
ALTER TABLE "customer_profiles" ADD COLUMN "ship_same_as_billing" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "customer_profiles" ADD COLUMN "shipping_address_line_1" TEXT;
ALTER TABLE "customer_profiles" ADD COLUMN "shipping_address_line_2" TEXT;
ALTER TABLE "customer_profiles" ADD COLUMN "shipping_city" TEXT;
ALTER TABLE "customer_profiles" ADD COLUMN "shipping_postal_code" TEXT;
ALTER TABLE "customer_profiles" ADD COLUMN "shipping_country_code" TEXT;

-- Order payment + shipping snapshot
CREATE TYPE "PaymentMethod" AS ENUM ('COD', 'ONLINE_CARD');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

ALTER TABLE "orders" ADD COLUMN "shipping_recipient_name" TEXT;
ALTER TABLE "orders" ADD COLUMN "shipping_phone" TEXT;
ALTER TABLE "orders" ADD COLUMN "shipping_country_code" TEXT;
ALTER TABLE "orders" ADD COLUMN "shipping_city" TEXT;
ALTER TABLE "orders" ADD COLUMN "shipping_postal_code" TEXT;
ALTER TABLE "orders" ADD COLUMN "shipping_address_line_1" TEXT;
ALTER TABLE "orders" ADD COLUMN "shipping_address_line_2" TEXT;
ALTER TABLE "orders" ADD COLUMN "payment_method" "PaymentMethod" NOT NULL DEFAULT 'COD';
ALTER TABLE "orders" ADD COLUMN "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PAID';
ALTER TABLE "orders" ADD COLUMN "checkout_idempotency_key" TEXT;

CREATE UNIQUE INDEX "orders_buyer_user_id_checkout_idempotency_key_key" ON "orders" ("buyer_user_id", "checkout_idempotency_key");
