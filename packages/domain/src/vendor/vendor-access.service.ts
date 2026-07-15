import type { VendorPermissionCode } from "@mlm/shared";
import { expandLegacyVendorPermissionCodes, isMarketCode, type MarketCode } from "@mlm/shared";
import { prisma } from "@mlm/db";
import { getEffectiveVendorPermissions } from "./vendor-permissions.service";

export type VendorAccessContext = {
  vendorId: string;
  isOwner: boolean;
  memberId: string | null;
};

/** Resolves vendor access for an owner or active team member in the active marketplace. */
export async function resolveVendorAccessForUser(
  userId: string,
  marketId?: string,
): Promise<VendorAccessContext | null> {
  const marketFilter = marketId ? { marketId } : {};

  const owned = await prisma.vendor.findFirst({
    where: { ownerUserId: userId, ...marketFilter },
    select: { id: true },
  });
  if (owned) {
    return { vendorId: owned.id, isOwner: true, memberId: null };
  }

  const member = await prisma.vendorMember.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      ...(marketId ? { vendor: { marketId } } : {}),
    },
    select: { id: true, vendorId: true },
  });
  if (member) {
    return { vendorId: member.vendorId, isOwner: false, memberId: member.id };
  }

  return null;
}

export async function getPermissionsForVendorActor(
  vendorId: string,
  actorUserId: string,
): Promise<VendorPermissionCode[]> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { ownerUserId: true },
  });
  if (!vendor) return [];

  if (vendor.ownerUserId === actorUserId) {
    return getEffectiveVendorPermissions(vendorId);
  }

  const member = await prisma.vendorMember.findFirst({
    where: { vendorId, userId: actorUserId, status: "ACTIVE" },
    select: { permissions: { select: { code: true } } },
  });
  if (!member) return [];

  return expandLegacyVendorPermissionCodes(member.permissions.map((p) => p.code));
}

export async function isVendorOwner(vendorId: string, userId: string): Promise<boolean> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { ownerUserId: true },
  });
  return vendor?.ownerUserId === userId;
}

/** First active marketplace (alphabetically by code) where the user owns or is an active team member. */
export async function resolveDefaultVendorMarketCode(userId: string): Promise<MarketCode | null> {
  const codes = new Set<MarketCode>();

  const owned = await prisma.vendor.findMany({
    where: { ownerUserId: userId },
    select: { market: { select: { code: true, isActive: true } } },
  });
  for (const row of owned) {
    if (row.market.isActive && isMarketCode(row.market.code)) {
      codes.add(row.market.code);
    }
  }

  const memberships = await prisma.vendorMember.findMany({
    where: { userId, status: "ACTIVE" },
    select: { vendor: { select: { market: { select: { code: true, isActive: true } } } } },
  });
  for (const row of memberships) {
    const market = row.vendor.market;
    if (market.isActive && isMarketCode(market.code)) {
      codes.add(market.code);
    }
  }

  const sorted = [...codes].sort();
  return sorted[0] ?? null;
}
