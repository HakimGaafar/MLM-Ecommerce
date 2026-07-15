import { listCustomerOrdersForBuyer } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { parsePaginationSearchParams } from "@/lib/api-pagination";
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

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "all";
  const dateRange = url.searchParams.get("dateRange") ?? "all";
  const dateFrom = url.searchParams.get("dateFrom") ?? "";
  const dateTo = url.searchParams.get("dateTo") ?? "";
  const { page, pageSize } = parsePaginationSearchParams(url.searchParams);

  const result = await listCustomerOrdersForBuyer({
    buyerUserId: auth.userId,
    marketId: market.id,
    defaultCurrency: market.defaultCurrency,
    statusFilter: status,
    dateRange,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    page,
    pageSize,
  });

  return NextResponse.json(
    {
      items: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore,
      filters: {
        status,
        dateRange,
        dateFrom,
        dateTo,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
