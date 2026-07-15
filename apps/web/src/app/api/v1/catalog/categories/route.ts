import { listPublicCategories } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { enforceIpRateLimit } from "@/lib/rate-limit-response";
import { resolveRequestLocale } from "@/lib/ui-locale";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(request: NextRequest) {
  const limited = await enforceIpRateLimit(request, "catalog-categories", 120, 60 * 1000);
  if (limited) return limited;

  const locale = await resolveRequestLocale(request);
  const market = await resolveRequestMarket();
  const items = await listPublicCategories(locale, market.id);
  return NextResponse.json(
    { items },
    {
      headers: {
        "Cache-Control": "no-store",
        Vary: "Cookie",
      },
    },
  );
}
