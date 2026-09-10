import { isStoreSlugAvailable, suggestSlugFromStoreName, resolveVendorAccessForUser } from "@mlm/domain";
import { STORE_SLUG_REGEX } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { getAccessTokenFromRequest, verifyAccessToken } from "@/lib/auth";
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

  let excludeVendorId: string | undefined;
  const token = getAccessTokenFromRequest(request);
  if (token) {
    const session = await verifyAccessToken(token).catch(() => null);
    if (session?.sub) {
      const access = await resolveVendorAccessForUser(session.sub, market.id);
      excludeVendorId = access?.vendorId;
    }
  }

  const available = await isStoreSlugAvailable(slug, excludeVendorId, market.id);
  return NextResponse.json({
    available,
    suggestion: available ? slug : suggestSlugFromStoreName(slug),
  });
}
