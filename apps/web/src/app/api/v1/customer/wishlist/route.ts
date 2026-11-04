import {
  addToWishlist,
  listWishlist,
  WishlistError,
} from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/require-customer-session";
import { resolveRequestMarket } from "@/lib/request-market";
import { resolveRequestCatalogDelivery } from "@/lib/catalog-delivery-context";
import { getAppLocale } from "@/lib/ui-locale";
import { publicErrorPayload } from "@/lib/api-error-response";

export async function GET(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const market = await resolveRequestMarket();
  const locale = await getAppLocale();
  const delivery = await resolveRequestCatalogDelivery({ marketCode: market.code });
  const items = await listWishlist(auth.userId, market.id, locale, delivery);
  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { productId?: string } | null;
  const productId = body?.productId?.trim();
  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  const market = await resolveRequestMarket();
  try {
    const item = await addToWishlist(auth.userId, market.id, productId);
    return NextResponse.json({ item }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof WishlistError) {
      return NextResponse.json(publicErrorPayload(e, { context: "api", code: e.code }), {
        status: e.code === "PRODUCT_UNAVAILABLE" ? 409 : 400,
      });
    }
    throw e;
  }
}
