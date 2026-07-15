import { getActiveMarket } from "@/lib/market-server";
import type { MarketScope } from "@mlm/shared";

/** Active marketplace for the current request (cookie, host, or geo fallback). */
export async function resolveRequestMarket(): Promise<MarketScope> {
  const market = await getActiveMarket();
  return {
    id: market.id,
    code: market.code,
    defaultCurrency: market.defaultCurrency,
  };
}
