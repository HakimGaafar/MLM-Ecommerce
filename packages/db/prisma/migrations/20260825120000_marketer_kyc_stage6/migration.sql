-- Stage 6: marketer identity form fields (type + number + photo)

CREATE TYPE "AffiliateIdentityDocumentKind" AS ENUM ('NATIONAL_ID', 'RESIDENCY', 'PASSPORT', 'OTHER');

ALTER TABLE "kyc_documents"
  ADD COLUMN "identity_document_kind" "AffiliateIdentityDocumentKind",
  ADD COLUMN "identity_document_kind_other" VARCHAR(120),
  ADD COLUMN "document_number" VARCHAR(64);
