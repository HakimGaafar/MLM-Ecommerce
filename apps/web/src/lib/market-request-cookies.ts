import { ACTIVE_MARKET_COOKIE } from "@/lib/market-context";
import {
  DEFAULT_MARKET_CODE,
  DEFAULT_MARKET_ID,
  getMarketId,
  isMarketCodeFormat,
  isSeedMarketCode,
  type MarketCode,
} from "@mlm/shared";
import { prisma } from "@mlm/db";
import type { NextRequest } from "next/server";

export function resolveMarketCodeFromRequestCookies(request: NextRequest): string {
  const raw = request.cookies.get(ACTIVE_MARKET_COOKIE)?.value?.trim().toUpperCase();
  if (raw && isMarketCodeFormat(raw)) return raw;
  return DEFAULT_MARKET_CODE;
}

/** Sync seed-only fallback — prefer async resolve for DB markets. */
export function resolveMarketIdFromRequestCookies(request: NextRequest): string {
  const code = resolveMarketCodeFromRequestCookies(request);
  if (isSeedMarketCode(code)) return getMarketId(code);
  return DEFAULT_MARKET_ID;
}

/** Resolve cookie market code → DB id (seed + wizard markets). */
export async function resolveMarketIdFromRequestCookiesAsync(
  request: NextRequest,
): Promise<string> {
  const code = resolveMarketCodeFromRequestCookies(request);
  if (isSeedMarketCode(code)) return getMarketId(code);
  try {
    const row = await prisma.market.findUnique({
      where: { code },
      select: { id: true },
    });
    if (row) return row.id;
  } catch {
    // fall through
  }
  return DEFAULT_MARKET_ID;
}

export type { MarketCode };
