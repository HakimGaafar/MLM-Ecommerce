CREATE TYPE "ContactInquiryStatus" AS ENUM ('NEW', 'READ', 'RESOLVED');

CREATE TABLE "contact_inquiries" (
  "id" TEXT NOT NULL,
  "market_id" TEXT NOT NULL,
  "first_name" VARCHAR(80) NOT NULL,
  "last_name" VARCHAR(80) NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "message" TEXT NOT NULL,
  "status" "ContactInquiryStatus" NOT NULL DEFAULT 'NEW',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contact_inquiries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_inquiries_status_created_at_idx"
  ON "contact_inquiries" ("status", "created_at");

CREATE INDEX "contact_inquiries_market_id_created_at_idx"
  ON "contact_inquiries" ("market_id", "created_at");

CREATE INDEX "contact_inquiries_email_idx"
  ON "contact_inquiries" ("email");

ALTER TABLE "contact_inquiries"
  ADD CONSTRAINT "contact_inquiries_market_id_fkey"
  FOREIGN KEY ("market_id") REFERENCES "markets"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
