import { listMarketBanners } from "@mlm/domain";
import { NextResponse } from "next/server";
import { getAppLocale } from "@/lib/ui-locale";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET() {
  const market = await resolveRequestMarket();
  const locale = await getAppLocale();
  const items = await listMarketBanners({ marketId: market.id, locale });
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, max-age=60" } });
}
