import { getPublicStoreBySlug } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestCatalogDelivery } from "@/lib/catalog-delivery-context";
import { getAppLocale } from "@/lib/ui-locale";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(
  _request: NextRequest,
  context: Readonly<{ params: Promise<{ slug: string }> }>,
) {
  const { slug } = await context.params;
  if (!slug?.trim()) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const locale = await getAppLocale();
  const market = await resolveRequestMarket();
  const delivery = await resolveRequestCatalogDelivery({ marketCode: market.code });
  const store = await getPublicStoreBySlug(slug, locale, market.id, delivery);
  if (!store) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(
    { store },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
  );
}
