import { listPublicStores } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { parsePaginationSearchParams } from "@/lib/api-pagination";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(request: NextRequest) {
  const { page, pageSize } = parsePaginationSearchParams(request.nextUrl.searchParams);
  const market = await resolveRequestMarket();
  const result = await listPublicStores({ page, pageSize, marketId: market.id });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
