export type PlatformInvoiceEntity = {
  legalName: string;
  vatTrn: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  postalCode: string;
  countryCode: string;
  logoUrl: string | null;
};

/** Vandsoq platform entity on commission invoices (env with dev fallbacks). */
export function getPlatformInvoiceEntity(): PlatformInvoiceEntity {
  return {
    legalName: process.env.VANDSOQ_LEGAL_NAME?.trim() || "Vandsoq Marketplace",
    vatTrn: process.env.VANDSOQ_VAT_TRN?.trim() || null,
    addressLine1: process.env.VANDSOQ_ADDRESS_LINE1?.trim() || "Riyadh, Saudi Arabia",
    addressLine2: process.env.VANDSOQ_ADDRESS_LINE2?.trim() || null,
    city: process.env.VANDSOQ_CITY?.trim() || "Riyadh",
    postalCode: process.env.VANDSOQ_POSTAL_CODE?.trim() || "11564",
    countryCode: process.env.VANDSOQ_COUNTRY_CODE?.trim().toUpperCase() || "SA",
    logoUrl: process.env.VANDSOQ_LOGO_URL?.trim() || null,
  };
}

export function isInvoiceGateBypassed(): boolean {
  return process.env.INVOICE_ALLOW_BEFORE_RETURN_WINDOW === "true";
}
