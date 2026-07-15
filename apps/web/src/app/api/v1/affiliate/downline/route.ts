import {
  AffiliateDashboardError,
  listAffiliateDownlineForUser,
} from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { parsePaginationSearchParams } from "@/lib/api-pagination";
import { requireCustomerSession } from "@/lib/require-customer-session";

export async function GET(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { page, pageSize } = parsePaginationSearchParams(request.nextUrl.searchParams);

  try {
    const result = await listAffiliateDownlineForUser({
      userId: auth.userId,
      page,
      pageSize,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AffiliateDashboardError && error.code === "NOT_ENROLLED") {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 404 });
    }
    throw error;
  }
}
