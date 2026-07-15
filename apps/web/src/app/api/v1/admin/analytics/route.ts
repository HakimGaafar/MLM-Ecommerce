import { getAdminAnalytics } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const market = await resolveRequestMarket();
  const analytics = await getAdminAnalytics(market.id);
  return NextResponse.json({ analytics }, { headers: { "Cache-Control": "no-store" } });
}
