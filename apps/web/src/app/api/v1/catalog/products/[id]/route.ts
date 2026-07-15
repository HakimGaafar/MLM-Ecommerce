import { getPublicProductById } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
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
  const product = await getPublicProductById(id, locale, market.id);
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(product, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
