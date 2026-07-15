import type { NextRequest } from "next/server";
import { getAccessTokenFromRequest, verifyAccessToken } from "@/lib/auth";

export type SuperAdminSessionAuth =
  | null
  | { userId: string; authorized: false }
  | { userId: string; authorized: true; roles: string[] };

export async function requireSuperAdminSession(
  request: NextRequest,
): Promise<SuperAdminSessionAuth> {
  const token = getAccessTokenFromRequest(request);
  if (!token) return null;

  const session = await verifyAccessToken(token).catch(() => null);
  if (!session?.sub) return null;

  const roles = session.roles ?? [];
  if (!roles.includes("SUPER_ADMIN")) {
    return { userId: session.sub, authorized: false };
  }

  return { userId: session.sub, authorized: true, roles };
}

export function userHasSuperAdminRole(roles: string[] = []): boolean {
  return roles.includes("SUPER_ADMIN");
}

export function userHasAdminAccess(roles: string[] = []): boolean {
  return roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
}
