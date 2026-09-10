import { prisma } from "@mlm/db";
import type { KycDocumentType } from "@mlm/db";
import { buildKycSubjectKey } from "./kyc-requirements";

export type VendorBusinessFlagsDto = {
  hasPhysicalShop: boolean;
  hasCommercialLicense: boolean;
  licenseTypeCode: string | null;
  licenseTypeOther: string | null;
  ecommerceOnLicense: boolean;
};

/** Vendor declared tax registration via VAT/TRN or an uploaded tax certificate. */
export async function vendorHasTaxRegistration(vendorId: string): Promise<boolean> {
  const subjectKey = buildKycSubjectKey("VENDOR", vendorId);
  const [vendor, taxDoc] = await Promise.all([
    prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { invoiceVatTrn: true },
    }),
    prisma.kycDocument.findUnique({
      where: {
        subjectKey_documentType: {
          subjectKey,
          documentType: "TAX_CERTIFICATE",
        },
      },
      select: { id: true },
    }),
  ]);

  return Boolean(vendor?.invoiceVatTrn?.trim() || taxDoc);
}

export async function getVendorBusinessFlags(vendorId: string): Promise<VendorBusinessFlagsDto> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      hasPhysicalShop: true,
      hasCommercialLicense: true,
      licenseTypeCode: true,
      licenseTypeOther: true,
      ecommerceOnLicense: true,
    },
  });
  return {
    hasPhysicalShop: Boolean(vendor?.hasPhysicalShop),
    hasCommercialLicense: Boolean(vendor?.hasCommercialLicense),
    licenseTypeCode: vendor?.licenseTypeCode ?? null,
    licenseTypeOther: vendor?.licenseTypeOther ?? null,
    ecommerceOnLicense: Boolean(vendor?.ecommerceOnLicense),
  };
}

export async function vendorHasPhysicalShop(vendorId: string): Promise<boolean> {
  const flags = await getVendorBusinessFlags(vendorId);
  return flags.hasPhysicalShop;
}

export async function resolveVendorKycRequiredDocuments(vendorId: string): Promise<KycDocumentType[]> {
  const base: KycDocumentType[] = ["COMMERCIAL_REGISTRATION", "REPRESENTATIVE_ID", "IBAN"];
  const extras: KycDocumentType[] = [];
  const flags = await getVendorBusinessFlags(vendorId);
  if (await vendorHasTaxRegistration(vendorId)) {
    extras.push("TAX_CERTIFICATE", "PROOF_OF_ADDRESS");
  }
  if (flags.hasPhysicalShop || flags.hasCommercialLicense) {
    extras.push("LICENSE");
  }
  return [...base, ...extras];
}

export async function updateVendorBusinessFlags(params: {
  vendorId: string;
  hasPhysicalShop?: boolean;
  hasCommercialLicense?: boolean;
  licenseTypeCode?: string | null;
  licenseTypeOther?: string | null;
  ecommerceOnLicense?: boolean;
}): Promise<VendorBusinessFlagsDto> {
  const current = await getVendorBusinessFlags(params.vendorId);
  const hasPhysicalShop = params.hasPhysicalShop ?? current.hasPhysicalShop;
  const hasCommercialLicense = params.hasCommercialLicense ?? current.hasCommercialLicense;
  let licenseTypeCode =
    params.licenseTypeCode !== undefined ? params.licenseTypeCode : current.licenseTypeCode;
  let licenseTypeOther =
    params.licenseTypeOther !== undefined ? params.licenseTypeOther : current.licenseTypeOther;
  const ecommerceOnLicense = params.ecommerceOnLicense ?? current.ecommerceOnLicense;

  if (!hasCommercialLicense) {
    licenseTypeCode = null;
    licenseTypeOther = null;
  } else if (licenseTypeCode !== "OTHER") {
    licenseTypeOther = null;
  }

  const row = await prisma.vendor.update({
    where: { id: params.vendorId },
    data: {
      hasPhysicalShop,
      hasCommercialLicense,
      licenseTypeCode,
      licenseTypeOther,
      ecommerceOnLicense: hasCommercialLicense ? ecommerceOnLicense : false,
    },
    select: {
      hasPhysicalShop: true,
      hasCommercialLicense: true,
      licenseTypeCode: true,
      licenseTypeOther: true,
      ecommerceOnLicense: true,
    },
  });

  return {
    hasPhysicalShop: row.hasPhysicalShop,
    hasCommercialLicense: row.hasCommercialLicense,
    licenseTypeCode: row.licenseTypeCode,
    licenseTypeOther: row.licenseTypeOther,
    ecommerceOnLicense: row.ecommerceOnLicense,
  };
}
