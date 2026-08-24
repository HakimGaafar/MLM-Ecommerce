-- Vendor physical shop flag (KYC license conditional)
ALTER TABLE "vendors" ADD COLUMN "has_physical_shop" BOOLEAN NOT NULL DEFAULT false;

-- Phone verification timestamp on customer profile
ALTER TABLE "customer_profiles" ADD COLUMN "phone_verified_at" TIMESTAMP(3);

-- Phone OTP purpose
ALTER TYPE "OtpChallengePurpose" ADD VALUE 'PHONE_VERIFICATION';
