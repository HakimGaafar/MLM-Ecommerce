import { listAdminVendorPayoutInvoices } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const market = await resolveRequestMarket();
  const statusParam = request.nextUrl.searchParams.get("status");
  const status =
    statusParam === "PENDING_REVIEW" || statusParam === "ACCEPTED" || statusParam === "NEEDS_FIX"
      ? statusParam
      : undefined;

  const result = await listAdminVendorPayoutInvoices({
    marketId: market.id,
    status,
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
