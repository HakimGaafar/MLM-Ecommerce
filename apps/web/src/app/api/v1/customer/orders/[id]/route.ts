import { findCustomerOrderHomeMarket, getCustomerOrderForBuyer } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/require-customer-session";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireCustomerSession(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }

  const market = await resolveRequestMarket();
  const order = await getCustomerOrderForBuyer(auth.userId, id, market.id, market.defaultCurrency);
  if (!order) {
    const homeMarket = await findCustomerOrderHomeMarket(auth.userId, id);
    if (homeMarket && homeMarket.marketId !== market.id) {
      return NextResponse.json(
        {
          error: "WRONG_MARKET",
          homeMarketCode: homeMarket.marketCode,
          homeMarketNameEn: homeMarket.marketNameEn,
          homeMarketNameAr: homeMarket.marketNameAr,
        },
        { status: 404 },
      );
    }
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(order, {
    headers: { "Cache-Control": "no-store" },
  });
}
