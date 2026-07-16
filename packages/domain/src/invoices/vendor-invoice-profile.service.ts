import { prisma } from "@mlm/db";
import type { VendorInvoiceProfileInput } from "@mlm/shared";

export type VendorInvoiceProfileDto = {
  legalName: string;
  vatTrn: string | null;
  vatPercent: number | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  countryCode: string;
  logoUrl: string | null;
  complete: boolean;
};

type VendorInvoiceRow = {
  storeName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  countryCode: string;
  logoUrl: string | null;
  invoiceLegalName: string | null;
  invoiceVatTrn: string | null;
  invoiceVatPercent: { toString(): string } | null;
  invoiceAddressLine1: string | null;
  invoiceAddressLine2: string | null;
  invoiceCity: string | null;
  invoicePostalCode: string | null;
  invoiceCountryCode: string | null;
  invoiceLogoUrl: string | null;
};

const profileSelect = {
  storeName: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  postalCode: true,
  countryCode: true,
  logoUrl: true,
  invoiceLegalName: true,
  invoiceVatTrn: true,
  invoiceVatPercent: true,
  invoiceAddressLine1: true,
  invoiceAddressLine2: true,
  invoiceCity: true,
  invoicePostalCode: true,
  invoiceCountryCode: true,
  invoiceLogoUrl: true,
} as const;

export function resolveVendorInvoiceProfile(row: VendorInvoiceRow): VendorInvoiceProfileDto {
  const legalName = row.invoiceLegalName?.trim() || row.storeName;
  const addressLine1 = row.invoiceAddressLine1?.trim() || row.addressLine1;
  const addressLine2 = row.invoiceAddressLine2?.trim() || row.addressLine2;
  const city = row.invoiceCity?.trim() || row.city;
  const postalCode = row.invoicePostalCode?.trim() || row.postalCode;
  const countryCode = row.invoiceCountryCode?.trim() || row.countryCode;
  const logoUrl = row.invoiceLogoUrl?.trim() || row.logoUrl;

  const complete = Boolean(
    legalName && addressLine1 && city && postalCode && countryCode,
  );

  return {
    legalName,
    vatTrn: row.invoiceVatTrn?.trim() || null,
    vatPercent: row.invoiceVatPercent != null ? Number(row.invoiceVatPercent) : null,
    addressLine1,
    addressLine2: addressLine2 ?? null,
    city,
    postalCode,
    countryCode,
    logoUrl: logoUrl ?? null,
    complete,
  };
}

export async function getVendorInvoiceProfile(vendorId: string): Promise<VendorInvoiceProfileDto | null> {
  const row = await prisma.vendor.findFirst({
    where: { id: vendorId },
    select: profileSelect,
  });
  if (!row) return null;
  return resolveVendorInvoiceProfile(row);
}

export async function updateVendorInvoiceProfile(
  vendorId: string,
  input: VendorInvoiceProfileInput,
): Promise<VendorInvoiceProfileDto | null> {
  const row = await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      invoiceLegalName: input.legalName,
      invoiceVatTrn: input.vatTrn ?? null,
      invoiceVatPercent: input.vatPercent ?? null,
      invoiceAddressLine1: input.addressLine1,
      invoiceAddressLine2: input.addressLine2 ?? null,
      invoiceCity: input.city,
      invoicePostalCode: input.postalCode,
      invoiceCountryCode: input.countryCode.toUpperCase(),
      invoiceLogoUrl: input.logoUrl ?? null,
    },
    select: profileSelect,
  });
  return resolveVendorInvoiceProfile(row);
}
