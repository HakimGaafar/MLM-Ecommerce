import { searchPublicProducts } from "@mlm/domain";
import { PublicProductListQuerySchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestCatalogDelivery } from "@/lib/catalog-delivery-context";
import { enforceIpRateLimit } from "@/lib/rate-limit-response";
import { resolveRequestLocale } from "@/lib/ui-locale";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(request: NextRequest) {
  const limited = await enforceIpRateLimit(request, "catalog-products", 120, 60 * 1000);
  if (limited) return limited;

  const locale = await resolveRequestLocale(request);
  const url = new URL(request.url);
  const parsed = PublicProductListQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    categorySlug: url.searchParams.get("categorySlug") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    vendorId: url.searchParams.get("vendorId") ?? undefined,
    minPrice: url.searchParams.get("minPrice") ?? undefined,
    maxPrice: url.searchParams.get("maxPrice") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    deliveryCountryCode: url.searchParams.get("deliveryCountryCode") ?? undefined,
    deliveryCity: url.searchParams.get("deliveryCity") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", issues: parsed.error.flatten() }, { status: 400 });
  }

  const market = await resolveRequestMarket();
  const { deliveryCountryCode, deliveryCity, ...query } = parsed.data;
  const delivery = await resolveRequestCatalogDelivery({
    marketCode: market.code,
    deliveryCountryCode,
    deliveryCity,
  });
  const result = await searchPublicProducts({
    ...query,
    locale,
    marketId: market.id,
    delivery,
  });

  return NextResponse.json(
    result,
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
