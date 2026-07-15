import { cache } from "react";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { verifyAccessToken } from "@/lib/auth";

export type AppRole = "ADMIN" | "VENDOR" | "CUSTOMER" | "AFFILIATE";

async function readServerSession() {
  const token = (await cookies()).get(env.AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAccessToken(token).catch(() => null);
}

/** Request-scoped session (deduped across layout + page + components in one render). */
export const getServerSession = cache(readServerSession);

export function resolvePrimaryRole(roles: string[] = []): AppRole | null {
  if (roles.includes("ADMIN") || roles.includes("SUPER_ADMIN")) return "ADMIN";
  if (roles.includes("VENDOR")) return "VENDOR";
  if (roles.includes("CUSTOMER")) return "CUSTOMER";
  if (roles.includes("AFFILIATE")) return "AFFILIATE";
  return null;
}
