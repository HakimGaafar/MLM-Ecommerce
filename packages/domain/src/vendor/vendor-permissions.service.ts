import { prisma } from "@mlm/db";
import type { VendorPermissionCode } from "@mlm/shared";
import {
  expandLegacyVendorPermissionCodes,
  VENDOR_PERMISSION_CODES,
  vendorHasPermission,
} from "@mlm/shared";
import { getPermissionsForVendorActor, isVendorOwner } from "./vendor-access.service";

export class VendorPermissionError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "FORBIDDEN",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "VendorPermissionError";
  }
}

/** Empty grant list = implicit full access (all codes). */
export async function getEffectiveVendorPermissions(vendorId: string): Promise<VendorPermissionCode[]> {
  const rows = await prisma.vendorPermission.findMany({
    where: { vendorId },
    select: { code: true },
  });
  if (rows.length === 0) {
    return [...VENDOR_PERMISSION_CODES];
  }
  return expandLegacyVendorPermissionCodes(rows.map((r) => r.code));
}

export async function assertVendorPermission(
  vendorId: string,
  permission: VendorPermissionCode,
  actorUserId: string,
): Promise<void> {
  const effective = await getPermissionsForVendorActor(vendorId, actorUserId);
  if (!vendorHasPermission(effective, permission)) {
    throw new VendorPermissionError("FORBIDDEN", "You do not have permission to perform this action.");
  }
}

export async function assertVendorOwner(vendorId: string, actorUserId: string): Promise<void> {
  if (!(await isVendorOwner(vendorId, actorUserId))) {
    throw new VendorPermissionError("FORBIDDEN", "Only the store owner can perform this action.");
  }
}

export type VendorPermissionStateDto = {
  vendorId: string;
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  usesDefaultFullAccess: boolean;
  grantedCodes: VendorPermissionCode[];
  allCodes: VendorPermissionCode[];
};

export async function getVendorPermissionState(vendorId: string): Promise<VendorPermissionStateDto | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      owner: { select: { name: true, email: true } },
      permissions: { select: { code: true } },
    },
  });
  if (!vendor) return null;

  const usesDefaultFullAccess = vendor.permissions.length === 0;
  const grantedCodes = usesDefaultFullAccess
    ? [...VENDOR_PERMISSION_CODES]
    : expandLegacyVendorPermissionCodes(vendor.permissions.map((p) => p.code));

  return {
    vendorId: vendor.id,
    storeName: vendor.storeName,
    ownerName: vendor.owner.name,
    ownerEmail: vendor.owner.email,
    usesDefaultFullAccess,
    grantedCodes,
    allCodes: [...VENDOR_PERMISSION_CODES],
  };
}

export async function setVendorPermissions(
  vendorId: string,
  codes: VendorPermissionCode[],
  grantedByUserId?: string,
): Promise<VendorPermissionStateDto> {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
  if (!vendor) {
    throw new VendorPermissionError("NOT_FOUND", "Vendor not found.");
  }

  const unique = [...new Set(codes)];

  await prisma.$transaction([
    prisma.vendorPermission.deleteMany({ where: { vendorId } }),
    ...(unique.length > 0
      ? [
          prisma.vendorPermission.createMany({
            data: unique.map((code) => ({
              vendorId,
              code,
              grantedByUserId: grantedByUserId ?? null,
            })),
          }),
        ]
      : []),
  ]);

  const state = await getVendorPermissionState(vendorId);
  if (!state) {
    throw new VendorPermissionError("NOT_FOUND", "Vendor not found.");
  }
  return state;
}
