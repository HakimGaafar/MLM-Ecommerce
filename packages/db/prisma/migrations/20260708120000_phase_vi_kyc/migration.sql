-- CreateEnum
CREATE TYPE "KycSubjectType" AS ENUM ('CUSTOMER', 'AFFILIATE', 'VENDOR');

-- CreateEnum
CREATE TYPE "KycDocumentType" AS ENUM ('NATIONAL_ID', 'IBAN', 'COMMERCIAL_REGISTRATION', 'LICENSE', 'TAX_CERTIFICATE', 'REPRESENTATIVE_ID');

-- CreateEnum
CREATE TYPE "KycDocumentStatus" AS ENUM ('UPLOADED', 'PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "kyc_documents" (
    "id" TEXT NOT NULL,
    "subject_type" "KycSubjectType" NOT NULL,
    "subject_key" VARCHAR(100) NOT NULL,
    "user_id" TEXT,
    "vendor_id" TEXT,
    "document_type" "KycDocumentType" NOT NULL,
    "status" "KycDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "storage_key" VARCHAR(500) NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "document_expires_at" TIMESTAMP(3),
    "iban_number" VARCHAR(34),
    "rejection_reason" TEXT,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kyc_documents_subject_key_document_type_key" ON "kyc_documents"("subject_key", "document_type");

-- CreateIndex
CREATE INDEX "kyc_documents_status_submitted_at_idx" ON "kyc_documents"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "kyc_documents_user_id_subject_type_idx" ON "kyc_documents"("user_id", "subject_type");

-- CreateIndex
CREATE INDEX "kyc_documents_vendor_id_idx" ON "kyc_documents"("vendor_id");

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
