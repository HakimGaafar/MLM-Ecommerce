import { getPublicProductById } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestCatalogDelivery } from "@/lib/catalog-delivery-context";
import { resolveRequestMarket } from "@/lib/request-market";
import { resolveRequestLocale } from "@/lib/ui-locale";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const market = await resolveRequestMarket();
  const locale = await resolveRequestLocale(request);
  const url = new URL(request.url);
  const delivery = await resolveRequestCatalogDelivery({
    marketCode: market.code,
    deliveryCountryCode: url.searchParams.get("deliveryCountryCode"),
    deliveryCity: url.searchParams.get("deliveryCity"),
  });
  const product = await getPublicProductById(id, locale, market.id, delivery);
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(product, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
