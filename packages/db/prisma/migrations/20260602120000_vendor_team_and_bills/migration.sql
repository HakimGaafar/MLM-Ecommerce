-- CreateEnum
CREATE TYPE "VendorMemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "VendorBillType" AS ENUM ('PLAN_FEE', 'PLATFORM_FEE');

-- CreateEnum
CREATE TYPE "VendorBillStatus" AS ENUM ('PENDING', 'PAID', 'WAIVED');

-- CreateTable
CREATE TABLE "vendor_members" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "user_id" TEXT,
    "status" "VendorMemberStatus" NOT NULL DEFAULT 'PENDING',
    "invite_token" VARCHAR(64) NOT NULL,
    "invited_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_member_permissions" (
    "member_id" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,

    CONSTRAINT "vendor_member_permissions_pkey" PRIMARY KEY ("member_id","code")
);

-- CreateTable
CREATE TABLE "vendor_bills" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "type" "VendorBillType" NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'SAR',
    "status" "VendorBillStatus" NOT NULL DEFAULT 'PENDING',
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_bills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_members_invite_token_key" ON "vendor_members"("invite_token");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_members_vendor_id_email_key" ON "vendor_members"("vendor_id", "email");

-- CreateIndex
CREATE INDEX "vendor_members_user_id_status_idx" ON "vendor_members"("user_id", "status");

-- CreateIndex
CREATE INDEX "vendor_members_vendor_id_status_idx" ON "vendor_members"("vendor_id", "status");

-- CreateIndex
CREATE INDEX "vendor_bills_vendor_id_created_at_idx" ON "vendor_bills"("vendor_id", "created_at");

-- AddForeignKey
ALTER TABLE "vendor_members" ADD CONSTRAINT "vendor_members_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_members" ADD CONSTRAINT "vendor_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_members" ADD CONSTRAINT "vendor_members_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_member_permissions" ADD CONSTRAINT "vendor_member_permissions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "vendor_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
