import { removeCartItem, updateCartItemQuantity } from "@mlm/domain";
import { CartUpdateItemQuantitySchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/require-customer-session";
import { resolveRequestMarket } from "@/lib/request-market";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> },
) {
  const auth = await requireCustomerSession(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { itemId } = await context.params;
  if (!itemId?.trim()) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = CartUpdateItemQuantitySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const market = await resolveRequestMarket();
    const cart = await updateCartItemQuantity(
      auth.userId,
      itemId,
      parsed.data.quantity,
      market.id,
      market.defaultCurrency,
    );
    return NextResponse.json(cart, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "ITEM_NOT_FOUND" || error.message === "CART_NOT_FOUND")
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> },
) {
  const auth = await requireCustomerSession(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { itemId } = await context.params;
  if (!itemId?.trim()) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  const market = await resolveRequestMarket();
  const cart = await removeCartItem(auth.userId, itemId, market.id, market.defaultCurrency);
  return NextResponse.json(cart, {
    headers: { "Cache-Control": "no-store" },
  });
}
