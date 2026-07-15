import { listPendingNewProducts } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const market = await resolveRequestMarket();
  const items = await listPendingNewProducts({ marketId: market.id });
  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
