import { listVendorsUnderOnboardingReview } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
  const market = await resolveRequestMarket();
  const result = await listVendorsUnderOnboardingReview({
    marketId: market.id,
    page,
    pageSize,
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
