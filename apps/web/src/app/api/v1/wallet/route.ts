import { getWalletSummary } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { getSessionTokenFromRequest, verifySessionToken } from "@/lib/auth";
import { resolveRequestMarket } from "@/lib/request-market";

/** Legacy route — prefer GET /api/v1/customer/wallet for customer apps. */
export async function GET(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifySessionToken(token).catch(() => null);
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const market = await resolveRequestMarket();
  const summary = await getWalletSummary(session.sub, market.id);
  return NextResponse.json({
    currency: summary.currency,
    availableBalance: summary.availableBalance,
    pendingBalance: summary.pendingBalance,
    lockedBalance: summary.lockedBalance,
  });
}
