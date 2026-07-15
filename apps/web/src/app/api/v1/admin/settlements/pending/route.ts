import { listAdminPendingSettlements } from "@mlm/domain";
import type { WalletEntryType } from "@mlm/db";
import { NextRequest, NextResponse } from "next/server";
import { parsePaginationSearchParams } from "@/lib/api-pagination";
import { requireAdminSession } from "@/lib/require-admin-session";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = request.nextUrl;
  const userId = url.searchParams.get("userId")?.trim() || undefined;
  const entryTypeParam = url.searchParams.get("entryType");
  const entryType =
    entryTypeParam === "AFFILIATE_COMMISSION" || entryTypeParam === "VENDOR_EARNING"
      ? (entryTypeParam as WalletEntryType)
      : undefined;
  const { page, pageSize } = parsePaginationSearchParams(url.searchParams);
  const market = await resolveRequestMarket();

  const result = await listAdminPendingSettlements({ userId, entryType, page, pageSize, marketId: market.id });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
