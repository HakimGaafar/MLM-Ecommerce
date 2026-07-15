import { getPublicStoreBySlug } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
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
  const store = await getPublicStoreBySlug(slug, locale, market.id);
  if (!store) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(
    { store },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
  );
}
