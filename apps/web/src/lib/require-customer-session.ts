import type { NextRequest } from "next/server";
import { getAccessTokenFromRequest, verifyAccessToken } from "@/lib/auth";

export type CustomerSessionAuth =
  | null
  | { userId: string; authorized: false }
  | { userId: string; authorized: true; roles: string[] };

export async function requireCustomerSession(request: NextRequest): Promise<CustomerSessionAuth> {
  const token = getAccessTokenFromRequest(request);
  if (!token) return null;

  const session = await verifyAccessToken(token).catch(() => null);
  if (!session?.sub) return null;

  const roles = session.roles ?? [];
  if (!roles.includes("CUSTOMER")) {
    return { userId: session.sub, authorized: false };
  }

  return { userId: session.sub, authorized: true, roles };
}
