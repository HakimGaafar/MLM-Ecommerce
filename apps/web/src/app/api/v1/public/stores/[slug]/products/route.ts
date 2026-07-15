import { getPublicStoreBySlug, listPublicStoreProducts } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { parsePaginationSearchParams } from "@/lib/api-pagination";
import { resolveRequestLocale } from "@/lib/ui-locale";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  if (!slug?.trim()) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const locale = await resolveRequestLocale(request);
  const market = await resolveRequestMarket();
  const store = await getPublicStoreBySlug(slug, locale, market.id);
  if (!store) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { page, pageSize } = parsePaginationSearchParams(request.nextUrl.searchParams);
  const result = await listPublicStoreProducts({
    vendorId: store.id,
    page,
    pageSize,
    locale,
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
