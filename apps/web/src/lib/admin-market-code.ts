import { resolveMarketIdByCodeOrNull } from "@mlm/domain";
import { isMarketCodeFormat } from "@mlm/shared";
import type { NextRequest } from "next/server";

/** Parse marketCode query param for admin APIs (seed + wizard DB codes). */
export function parseAdminMarketCode(request: NextRequest): string | null {
  const raw = request.nextUrl.searchParams.get("marketCode")?.trim().toUpperCase();
  return raw && isMarketCodeFormat(raw) ? raw : null;
}

/** Resolve marketId from marketCode (any DB market) or explicit marketId query. */
export async function resolveAdminMarketIdFromRequest(
  request: NextRequest,
): Promise<string | null> {
  const marketCode = parseAdminMarketCode(request);
  if (marketCode) {
    return resolveMarketIdByCodeOrNull(marketCode);
  }
  return request.nextUrl.searchParams.get("marketId")?.trim() || null;
}
