import { listAdminReleasedSettlements } from "@mlm/domain";
import type { WalletEntryType } from "@mlm/db";
import { NextRequest, NextResponse } from "next/server";
import { parsePaginationSearchParams } from "@/lib/api-pagination";
import { requireAdminSession } from "@/lib/require-admin-session";
import { resolveRequestMarket } from "@/lib/request-market";

function parseDateParam(value: string | null): Date | undefined {
  if (!value?.trim()) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = request.nextUrl;
  const userId = url.searchParams.get("userId")?.trim() || undefined;
  const settledByUserId = url.searchParams.get("settledByUserId")?.trim() || undefined;
  const entryTypeParam = url.searchParams.get("entryType");
  const entryType =
    entryTypeParam === "AFFILIATE_COMMISSION" || entryTypeParam === "VENDOR_EARNING"
      ? (entryTypeParam as WalletEntryType)
      : undefined;
  const dateFrom = parseDateParam(url.searchParams.get("dateFrom"));
  const dateTo = parseDateParam(url.searchParams.get("dateTo"));
  const { page, pageSize } = parsePaginationSearchParams(url.searchParams);
  const market = await resolveRequestMarket();

  const result = await listAdminReleasedSettlements({
    userId,
    settledByUserId,
    entryType,
    dateFrom,
    dateTo,
    page,
    pageSize,
    marketId: market.id,
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
