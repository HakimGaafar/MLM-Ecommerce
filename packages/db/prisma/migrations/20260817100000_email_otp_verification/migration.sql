-- Email OTP verification for cashback activation and first checkout.
ALTER TABLE "users"
  ADD COLUMN "email_verified_at" TIMESTAMP(3);

-- Grandfather users who already placed an order.
UPDATE "users" u
SET "email_verified_at" = NOW()
WHERE u."email_verified_at" IS NULL
  AND EXISTS (
    SELECT 1 FROM "orders" o WHERE o."buyer_user_id" = u."id"
  );

CREATE TYPE "OtpChallengePurpose" AS ENUM ('ACCOUNT_VERIFICATION');

CREATE TABLE "otp_challenges" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "purpose" "OtpChallengePurpose" NOT NULL,
  "code_hash" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "otp_challenges_user_id_purpose_used_at_idx" ON "otp_challenges"("user_id", "purpose", "used_at");
CREATE INDEX "otp_challenges_expires_at_idx" ON "otp_challenges"("expires_at");

ALTER TABLE "otp_challenges"
  ADD CONSTRAINT "otp_challenges_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
