import { prisma } from "@mlm/db";
import type { NextRequest } from "next/server";
import { getAccessTokenFromRequest, verifyAccessToken } from "@/lib/auth";

export type AffiliateSessionAuth =
  | null
  | { userId: string; authorized: false }
  | { userId: string; authorized: true };

export async function requireAffiliateSession(request: NextRequest): Promise<AffiliateSessionAuth> {
  const token = getAccessTokenFromRequest(request);
  if (!token) return null;

  const session = await verifyAccessToken(token).catch(() => null);
  if (!session?.sub) return null;

  const roleRows = await prisma.userRole.findMany({
    where: { userId: session.sub },
    select: { role: { select: { code: true } } },
  });

  const roles = roleRows.map((row) => row.role.code);
  const hasAffiliateRole = roles.includes("AFFILIATE");
  if (!hasAffiliateRole) return { userId: session.sub, authorized: false };

  return { userId: session.sub, authorized: true };
}
