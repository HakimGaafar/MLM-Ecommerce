import { isStoreSlugAvailable, suggestSlugFromStoreName } from "@mlm/domain";
import { STORE_SLUG_REGEX } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const slug = (url.searchParams.get("slug") ?? "").trim().toLowerCase();
  const storeName = url.searchParams.get("storeName") ?? "";

  if (!slug) {
    const suggestion = storeName ? suggestSlugFromStoreName(storeName) : "";
    return NextResponse.json({ available: false, suggestion, reason: "empty" });
  }

  if (!STORE_SLUG_REGEX.test(slug)) {
    return NextResponse.json({ available: false, suggestion: suggestSlugFromStoreName(slug), reason: "format" });
  }

  const market = await resolveRequestMarket();
  const available = await isStoreSlugAvailable(slug, undefined, market.id);
  return NextResponse.json({
    available,
    suggestion: available ? slug : suggestSlugFromStoreName(slug),
  });
}
