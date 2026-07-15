-- CreateTable
CREATE TABLE "customer_shipping_addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" VARCHAR(80),
    "recipient_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "postal_code" VARCHAR(20) NOT NULL,
    "address_line_1" VARCHAR(200) NOT NULL,
    "address_line_2" VARCHAR(200),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_shipping_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_shipping_addresses_user_id_idx" ON "customer_shipping_addresses"("user_id");

-- CreateIndex
CREATE INDEX "customer_shipping_addresses_user_id_is_default_idx" ON "customer_shipping_addresses"("user_id", "is_default");

-- AddForeignKey
ALTER TABLE "customer_shipping_addresses" ADD CONSTRAINT "customer_shipping_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
