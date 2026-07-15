-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "LedgerStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'REVERSED');

-- CreateEnum
CREATE TYPE "WalletEntryType" AS ENUM ('VENDOR_EARNING', 'AFFILIATE_COMMISSION', 'CASHBACK', 'WITHDRAWAL', 'ORDER_PAYMENT', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "available_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pending_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "locked_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entry_type" "WalletEntryType" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "LedgerStatus" NOT NULL DEFAULT 'PENDING',
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "meta_json" JSONB,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_profiles" (
    "user_id" TEXT NOT NULL,
    "referral_code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "referral_relations" (
    "child_user_id" TEXT NOT NULL,
    "parent_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_relations_pkey" PRIMARY KEY ("child_user_id","parent_user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_idempotency_key_key" ON "wallet_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "wallet_transactions_user_id_status_idx" ON "wallet_transactions"("user_id", "status");

-- CreateIndex
CREATE INDEX "wallet_transactions_reference_type_reference_id_idx" ON "wallet_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_profiles_referral_code_key" ON "affiliate_profiles"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "referral_relations_child_user_id_key" ON "referral_relations"("child_user_id");

-- CreateIndex
CREATE INDEX "referral_relations_parent_user_id_idx" ON "referral_relations"("parent_user_id");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_profiles" ADD CONSTRAINT "affiliate_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_relations" ADD CONSTRAINT "referral_relations_child_user_id_fkey" FOREIGN KEY ("child_user_id") REFERENCES "affiliate_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_relations" ADD CONSTRAINT "referral_relations_parent_user_id_fkey" FOREIGN KEY ("parent_user_id") REFERENCES "affiliate_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
