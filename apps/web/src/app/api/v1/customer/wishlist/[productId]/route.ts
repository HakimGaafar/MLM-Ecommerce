import { removeFromWishlist, WishlistError } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/require-customer-session";
import { resolveRequestMarket } from "@/lib/request-market";
import { publicErrorPayload } from "@/lib/api-error-response";

type RouteParams = { params: Promise<{ productId: string }> };

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireCustomerSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { productId } = await params;
  const market = await resolveRequestMarket();

  try {
    await removeFromWishlist(auth.userId, market.id, productId);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof WishlistError) {
      return NextResponse.json(publicErrorPayload(e, { context: "api", code: e.code }), {
        status: e.code === "NOT_FOUND" ? 404 : 400,
      });
    }
    throw e;
  }
}
