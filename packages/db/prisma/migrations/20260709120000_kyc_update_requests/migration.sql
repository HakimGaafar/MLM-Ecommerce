-- Admin-requested KYC document updates (user banner until admin accepts again)
ALTER TABLE "kyc_documents" ADD COLUMN "update_requested_at" TIMESTAMP(3);
ALTER TABLE "kyc_documents" ADD COLUMN "update_request_message" TEXT;
ALTER TABLE "kyc_documents" ADD COLUMN "update_requested_by_user_id" TEXT;

ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_update_requested_by_user_id_fkey"
  FOREIGN KEY ("update_requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "kyc_documents_update_requested_at_idx" ON "kyc_documents"("update_requested_at");
