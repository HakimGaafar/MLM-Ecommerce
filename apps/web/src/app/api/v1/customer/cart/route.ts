import { getCustomerCart } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/require-customer-session";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const market = await resolveRequestMarket();
  const cart = await getCustomerCart(auth.userId, market.id, market.defaultCurrency);
  return NextResponse.json(cart, {
    headers: { "Cache-Control": "no-store" },
  });
}
