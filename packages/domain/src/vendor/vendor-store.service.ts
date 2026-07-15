import type { VendorStoreUpdateInput } from "@mlm/shared";
import { seoFieldsToNullables } from "@mlm/shared";
import { prisma } from "@mlm/db";

export type VendorStoreDto = {
  id: string;
  storeName: string;
  slug: string;
  countryCode: string;
  addressLine1: string;
  addressLine2: string | null;
  state: string | null;
  city: string;
  postalCode: string;
  about: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  publicStoreUrl: string;
  updatedAt: string;
};

function toVendorStoreDto(row: {
  id: string;
  storeName: string;
  slug: string;
  countryCode: string;
  addressLine1: string;
  addressLine2: string | null;
  state: string | null;
  city: string;
  postalCode: string;
  about: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  updatedAt: Date;
}): VendorStoreDto {
  return {
    id: row.id,
    storeName: row.storeName,
    slug: row.slug,
    countryCode: row.countryCode,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    state: row.state,
    city: row.city,
    postalCode: row.postalCode,
    about: row.about,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    publicStoreUrl: `/stores/${row.slug}`,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const vendorSelect = {
  id: true,
  storeName: true,
  slug: true,
  countryCode: true,
  addressLine1: true,
  addressLine2: true,
  state: true,
  city: true,
  postalCode: true,
  about: true,
  metaTitle: true,
  metaDescription: true,
  updatedAt: true,
} as const;

export async function getVendorStore(vendorId: string): Promise<VendorStoreDto | null> {
  const row = await prisma.vendor.findFirst({
    where: { id: vendorId },
    select: vendorSelect,
  });
  if (!row) return null;
  return toVendorStoreDto(row);
}

export async function updateVendorStore(vendorId: string, input: VendorStoreUpdateInput): Promise<VendorStoreDto | null> {
  const row = await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      storeName: input.storeName,
      ...(input.about !== undefined ? { about: input.about?.trim() || null } : {}),
      ...seoFieldsToNullables({
        metaTitle: input.metaTitle,
        metaDescription: input.metaDescription,
      }),
    },
    select: vendorSelect,
  });
  return toVendorStoreDto(row);
}
