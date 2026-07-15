import { listAdminWithdrawals } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { parsePaginationSearchParams } from "@/lib/api-pagination";
import { requireAdminSession } from "@/lib/require-admin-session";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = request.nextUrl;
  const { page, pageSize } = parsePaginationSearchParams(url.searchParams);
  const scope = url.searchParams.get("scope") === "all" ? "all" : "affiliate";
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam === "APPROVED" || statusParam === "DECLINED" || statusParam === "PENDING"
      ? statusParam
      : "PENDING";
  const market = await resolveRequestMarket();

  const result = await listAdminWithdrawals({ page, pageSize, scope, status, marketId: market.id });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
