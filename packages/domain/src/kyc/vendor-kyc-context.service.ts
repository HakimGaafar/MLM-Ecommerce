import { prisma } from "@mlm/db";
import type { KycDocumentType } from "@mlm/db";
import { buildKycSubjectKey } from "./kyc-requirements";

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

export async function vendorHasPhysicalShop(vendorId: string): Promise<boolean> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { hasPhysicalShop: true },
  });
  return Boolean(vendor?.hasPhysicalShop);
}

export async function resolveVendorKycRequiredDocuments(vendorId: string): Promise<KycDocumentType[]> {
  const base: KycDocumentType[] = ["COMMERCIAL_REGISTRATION", "REPRESENTATIVE_ID", "IBAN"];
  const extras: KycDocumentType[] = [];
  if (await vendorHasTaxRegistration(vendorId)) {
    extras.push("TAX_CERTIFICATE", "PROOF_OF_ADDRESS");
  }
  if (await vendorHasPhysicalShop(vendorId)) {
    extras.push("LICENSE");
  }
  return [...base, ...extras];
}

export async function updateVendorBusinessFlags(params: {
  vendorId: string;
  hasPhysicalShop?: boolean;
}): Promise<{ hasPhysicalShop: boolean }> {
  if (params.hasPhysicalShop === undefined) {
    const current = await vendorHasPhysicalShop(params.vendorId);
    return { hasPhysicalShop: current };
  }
  const row = await prisma.vendor.update({
    where: { id: params.vendorId },
    data: { hasPhysicalShop: params.hasPhysicalShop },
    select: { hasPhysicalShop: true },
  });
  return { hasPhysicalShop: row.hasPhysicalShop };
}
