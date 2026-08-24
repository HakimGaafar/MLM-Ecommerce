import { getAdminPlatformConfigChangeLogs, listAdminPlatformConfigAudit } from "@mlm/domain";
import { getMarketId, isMarketCode } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/require-super-admin-session";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const marketCode = request.nextUrl.searchParams.get("marketCode")?.trim().toUpperCase();
  const marketIdParam = request.nextUrl.searchParams.get("marketId")?.trim();
  const pageRaw = request.nextUrl.searchParams.get("page");
  const pageSizeRaw = request.nextUrl.searchParams.get("pageSize");
  const limitRaw = request.nextUrl.searchParams.get("limit");

  let marketId: string | undefined;
  if (marketCode && marketCode !== "ALL" && isMarketCode(marketCode)) {
    marketId = getMarketId(marketCode);
  } else if (marketIdParam) {
    marketId = marketIdParam;
  }

  const page = pageRaw ? Number(pageRaw) : undefined;
  const pageSize = pageSizeRaw ? Number(pageSizeRaw) : undefined;

  if (limitRaw && !pageRaw) {
    if (!marketId) {
      return NextResponse.json({ error: "marketCode or marketId is required when using limit" }, { status: 400 });
    }
    try {
      const logs = await getAdminPlatformConfigChangeLogs({
        marketId,
        limit: Number(limitRaw),
      });
      return NextResponse.json({ logs }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof Error && error.message === "MARKET_NOT_FOUND") {
        return NextResponse.json({ error: "Market not found" }, { status: 404 });
      }
      throw error;
    }
  }

  try {
    const result = await listAdminPlatformConfigAudit({ marketId, page, pageSize });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "MARKET_NOT_FOUND") {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
    throw error;
  }
}
