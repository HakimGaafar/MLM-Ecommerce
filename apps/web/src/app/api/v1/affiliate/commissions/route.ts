import {
  AffiliateDashboardError,
  listAffiliateCommissionsForUser,
} from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { parsePaginationSearchParams } from "@/lib/api-pagination";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
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
  const { page, pageSize } = parsePaginationSearchParams(request.nextUrl.searchParams);
  const locale = await getCustomerPreferredLocale();

  try {
    const result = await listAffiliateCommissionsForUser({
      userId: auth.userId,
      marketId: market.id,
      page,
      pageSize,
      locale,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AffiliateDashboardError && error.code === "NOT_ENROLLED") {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 404 });
    }
    throw error;
  }
}
