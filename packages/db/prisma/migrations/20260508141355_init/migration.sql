-- CreateTable
CREATE TABLE "customer_profiles" (
    "user_id" TEXT NOT NULL,
    "phone" TEXT,
    "country_code" TEXT NOT NULL DEFAULT 'SA',
    "city" TEXT,
    "address_line_1" TEXT,
    "address_line_2" TEXT,
    "postal_code" TEXT,
    "preferred_language" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "customer_profiles_country_code_idx" ON "customer_profiles"("country_code");

-- CreateIndex
CREATE INDEX "customer_profiles_preferred_language_idx" ON "customer_profiles"("preferred_language");

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
