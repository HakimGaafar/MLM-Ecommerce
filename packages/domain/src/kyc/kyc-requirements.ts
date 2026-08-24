import type { KycDocumentType, KycSubjectType } from "@mlm/db";

/** Documents that must be ACCEPTED for KYC approval (non-vendor subjects). */
export const KYC_REQUIRED_DOCUMENTS: Record<Exclude<KycSubjectType, "VENDOR">, KycDocumentType[]> = {
  CUSTOMER: ["NATIONAL_ID", "IBAN"],
  AFFILIATE: ["NATIONAL_ID"],
};

/**
 * Optional / conditional documents (shown in UI, not required for approval by default).
 * Vendor: license, tax certificate, and proof of address depend on tax registration.
 */
export const KYC_CONDITIONAL_DOCUMENTS: Record<KycSubjectType, KycDocumentType[]> = {
  CUSTOMER: [],
  AFFILIATE: [],
  VENDOR: ["LICENSE", "TAX_CERTIFICATE", "PROOF_OF_ADDRESS"],
};

export const KYC_VENDOR_BASE_DOCUMENTS: KycDocumentType[] = [
  "COMMERCIAL_REGISTRATION",
  "REPRESENTATIVE_ID",
  "IBAN",
];

export function kycDocumentsForSubject(subjectType: KycSubjectType): KycDocumentType[] {
  if (subjectType === "VENDOR") {
    return [...KYC_VENDOR_BASE_DOCUMENTS, ...KYC_CONDITIONAL_DOCUMENTS.VENDOR];
  }
  return [...KYC_REQUIRED_DOCUMENTS[subjectType], ...KYC_CONDITIONAL_DOCUMENTS[subjectType]];
}

export function isKycDocumentRequired(
  subjectType: KycSubjectType,
  documentType: KycDocumentType,
  options?: { vendorRequiredDocuments?: readonly KycDocumentType[] },
): boolean {
  if (subjectType === "VENDOR") {
    const required = options?.vendorRequiredDocuments ?? KYC_VENDOR_BASE_DOCUMENTS;
    return required.includes(documentType);
  }
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
