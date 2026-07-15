import type { KycDocumentType, KycSubjectType } from "@mlm/db";

export const KYC_REQUIRED_DOCUMENTS: Record<KycSubjectType, KycDocumentType[]> = {
  CUSTOMER: ["NATIONAL_ID", "IBAN"],
  AFFILIATE: ["NATIONAL_ID", "IBAN"],
  VENDOR: [
    "COMMERCIAL_REGISTRATION",
    "LICENSE",
    "TAX_CERTIFICATE",
    "REPRESENTATIVE_ID",
    "IBAN",
  ],
};

export function buildKycSubjectKey(subjectType: KycSubjectType, subjectId: string): string {
  return `${subjectType.toLowerCase()}:${subjectId}`;
}

export function kycDocumentTypeRequiresExpiry(documentType: KycDocumentType): boolean {
  return documentType === "NATIONAL_ID" || documentType === "REPRESENTATIVE_ID";
}

export function kycDocumentTypeSupportsIbanNumber(documentType: KycDocumentType): boolean {
  return documentType === "IBAN";
}
