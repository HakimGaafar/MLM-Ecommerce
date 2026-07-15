import { ACTIVE_MARKET_COOKIE } from "@/lib/market-context";
import {
  DEFAULT_MARKET_CODE,
  getMarketId,
  isMarketCode,
  type MarketCode,
} from "@mlm/shared";
import type { NextRequest } from "next/server";

export function resolveMarketCodeFromRequestCookies(request: NextRequest): MarketCode {
  const raw = request.cookies.get(ACTIVE_MARKET_COOKIE)?.value;
  if (raw && isMarketCode(raw)) return raw;
  return DEFAULT_MARKET_CODE;
}

export function resolveMarketIdFromRequestCookies(request: NextRequest): string {
  return getMarketId(resolveMarketCodeFromRequestCookies(request));
}
