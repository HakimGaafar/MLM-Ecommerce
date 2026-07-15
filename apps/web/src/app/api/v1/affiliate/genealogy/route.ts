import { AffiliateDashboardError, getAffiliateGenealogyForUser } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/require-customer-session";

export async function GET(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const maxDepth = Math.min(3, Math.max(1, Number.parseInt(url.searchParams.get("depth") ?? "2", 10) || 2));

  try {
    const result = await getAffiliateGenealogyForUser({ userId: auth.userId, maxDepth });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AffiliateDashboardError && error.code === "NOT_ENROLLED") {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 404 });
    }
    throw error;
  }
}
