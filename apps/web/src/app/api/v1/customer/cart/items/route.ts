import { addCartItem } from "@mlm/domain";
import { CartAddItemSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/require-customer-session";
import { resolveRequestMarket } from "@/lib/request-market";

export async function POST(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = CartAddItemSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const market = await resolveRequestMarket();
    const cart = await addCartItem(
      auth.userId,
      parsed.data.productId,
      parsed.data.quantity,
      market.id,
      market.defaultCurrency,
    );
    return NextResponse.json(cart, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    throw error;
  }
}
