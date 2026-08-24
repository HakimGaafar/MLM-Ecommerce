import type { KycDocumentType, KycSubjectType } from "@mlm/db";

/** Documents that must be ACCEPTED for KYC approval. */
export const KYC_REQUIRED_DOCUMENTS: Record<KycSubjectType, KycDocumentType[]> = {
  CUSTOMER: ["NATIONAL_ID", "IBAN"],
  AFFILIATE: ["NATIONAL_ID"],
  VENDOR: [
    "COMMERCIAL_REGISTRATION",
    "REPRESENTATIVE_ID",
    "IBAN",
    "PROOF_OF_ADDRESS",
  ],
};

/**
 * Optional / conditional documents (shown in UI, not required for approval).
 * Vendor: license + tax certificate depend on business type.
 */
export const KYC_CONDITIONAL_DOCUMENTS: Record<KycSubjectType, KycDocumentType[]> = {
  CUSTOMER: [],
  AFFILIATE: [],
  VENDOR: ["LICENSE", "TAX_CERTIFICATE"],
};

export function kycDocumentsForSubject(subjectType: KycSubjectType): KycDocumentType[] {
  return [...KYC_REQUIRED_DOCUMENTS[subjectType], ...KYC_CONDITIONAL_DOCUMENTS[subjectType]];
}

export function isKycDocumentRequired(
  subjectType: KycSubjectType,
  documentType: KycDocumentType,
): boolean {
  return KYC_REQUIRED_DOCUMENTS[subjectType].includes(documentType);
}

export function isAllowedKycDocumentType(
  subjectType: KycSubjectType,
  documentType: KycDocumentType,
): boolean {
  return kycDocumentsForSubject(subjectType).includes(documentType);
}

export function buildKycSubjectKey(subjectType: KycSubjectType, subjectId: string): string {
  return `${subjectType.toLowerCase()}:${subjectId}`;
}

export function kycDocumentTypeRequiresExpiry(
  documentType: KycDocumentType,
  subjectType?: KycSubjectType,
): boolean {
  if (subjectType === "AFFILIATE" && documentType === "NATIONAL_ID") return false;
  return documentType === "NATIONAL_ID" || documentType === "REPRESENTATIVE_ID";
}

export function kycDocumentTypeSupportsIbanNumber(
  documentType: KycDocumentType,
  subjectType?: KycSubjectType,
): boolean {
  if (subjectType === "AFFILIATE") return false;
  return documentType === "IBAN";
}
