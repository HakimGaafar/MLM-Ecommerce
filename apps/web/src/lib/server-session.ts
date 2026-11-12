import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { verifyAccessToken } from "@/lib/auth";
import { type AppRole, resolvePrimaryRole } from "@/lib/app-role";

export type { AppRole };
export { resolvePrimaryRole };

async function readServerSession() {
  const token = (await cookies()).get(env.AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAccessToken(token).catch(() => null);
}

/** Request-scoped session (deduped across layout + page + components in one render). */
export const getServerSession = cache(readServerSession);
