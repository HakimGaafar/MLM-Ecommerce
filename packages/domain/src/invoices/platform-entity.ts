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

/** Fources platform entity on commission invoices (env with dev fallbacks). */
export function getPlatformInvoiceEntity(): PlatformInvoiceEntity {
  return {
    legalName: process.env.FORSEIZ_LEGAL_NAME?.trim() || "Fources Marketplace",
    vatTrn: process.env.FORSEIZ_VAT_TRN?.trim() || null,
    addressLine1: process.env.FORSEIZ_ADDRESS_LINE1?.trim() || "Riyadh, Saudi Arabia",
    addressLine2: process.env.FORSEIZ_ADDRESS_LINE2?.trim() || null,
    city: process.env.FORSEIZ_CITY?.trim() || "Riyadh",
    postalCode: process.env.FORSEIZ_POSTAL_CODE?.trim() || "11564",
    countryCode: process.env.FORSEIZ_COUNTRY_CODE?.trim().toUpperCase() || "SA",
    logoUrl: process.env.FORSEIZ_LOGO_URL?.trim() || null,
  };
}

export function isInvoiceGateBypassed(): boolean {
  return process.env.INVOICE_ALLOW_BEFORE_RETURN_WINDOW === "true";
}
