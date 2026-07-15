import { listWalletTransactionsForUser } from "@mlm/domain";
import type { WalletEntryType } from "@mlm/db";
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
  const url = new URL(request.url);
  const { page, pageSize } = parsePaginationSearchParams(url.searchParams);

  const locale = await getCustomerPreferredLocale();
  const entryTypeParam = url.searchParams.get("entryType");
  const entryType =
    entryTypeParam === "CASHBACK" ||
    entryTypeParam === "AFFILIATE_COMMISSION" ||
    entryTypeParam === "WITHDRAWAL"
      ? (entryTypeParam as WalletEntryType)
      : undefined;

  const result = await listWalletTransactionsForUser({
    userId: auth.userId,
    marketId: market.id,
    page,
    pageSize,
    locale,
    entryType,
  });

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
