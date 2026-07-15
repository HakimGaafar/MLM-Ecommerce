import { resolveVendorAccessForUser } from "@mlm/domain";
import { prisma } from "@mlm/db";
import type { NextRequest } from "next/server";
import { getAccessTokenFromRequest, verifyAccessToken } from "@/lib/auth";
import { resolveRequestMarket } from "@/lib/request-market";

export type VendorSessionAuth =
  | null
  | { userId: string; vendorId: null; authorized: false }
  | { userId: string; vendorId: string; authorized: true; isOwner: boolean; memberId: string | null };

export async function requireVendorSession(request: NextRequest): Promise<VendorSessionAuth> {
  const token = getAccessTokenFromRequest(request);
  if (!token) return null;

  const session = await verifyAccessToken(token).catch(() => null);
  if (!session?.sub) return null;

  const roleRows = await prisma.userRole.findMany({
    where: { userId: session.sub },
    select: { role: { select: { code: true } } },
  });

  const roles = roleRows.map((row) => row.role.code);
  if (!roles.includes("VENDOR")) {
    return { userId: session.sub, vendorId: null, authorized: false };
  }

  const access = await resolveVendorAccessForUser(session.sub, (await resolveRequestMarket()).id);
  if (!access) {
    return { userId: session.sub, vendorId: null, authorized: false };
  }

  return {
    userId: session.sub,
    vendorId: access.vendorId,
    authorized: true,
    isOwner: access.isOwner,
    memberId: access.memberId,
  };
}
