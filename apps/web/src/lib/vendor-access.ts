import {
  canAccessVendorPath,
  firstAllowedVendorNavHref,
  type VendorPermissionCode,
} from "@mlm/shared";
import { getPermissionsForVendorActor, resolveVendorAccessForUser } from "@mlm/domain";

export async function getVendorPermissionsForUser(
  userId: string,
  marketId?: string,
): Promise<VendorPermissionCode[]> {
  const access = await resolveVendorAccessForUser(userId, marketId);
  if (!access) return [];
  return getPermissionsForVendorActor(access.vendorId, userId);
}

/** @deprecated Use getVendorPermissionsForUser — supports owners and staff. */
export async function getVendorPermissionsForOwner(
  ownerUserId: string,
): Promise<VendorPermissionCode[]> {
  return getVendorPermissionsForUser(ownerUserId);
}

export async function userCanAccessVendorPath(
  userId: string,
  pathname: string,
  marketId?: string,
): Promise<boolean> {
  const perms = await getVendorPermissionsForUser(userId, marketId);
  return canAccessVendorPath(perms, pathname);
}

/** @deprecated Use userCanAccessVendorPath */
export async function ownerCanAccessVendorPath(ownerUserId: string, pathname: string): Promise<boolean> {
  return userCanAccessVendorPath(ownerUserId, pathname);
}

export async function firstAllowedVendorHrefForUser(
  userId: string,
  marketId?: string,
): Promise<string | null> {
  const perms = await getVendorPermissionsForUser(userId, marketId);
  return firstAllowedVendorNavHref(perms);
}

/** @deprecated Use firstAllowedVendorHrefForUser */
export async function firstAllowedVendorHrefForOwner(ownerUserId: string): Promise<string | null> {
  return firstAllowedVendorHrefForUser(ownerUserId);
}
