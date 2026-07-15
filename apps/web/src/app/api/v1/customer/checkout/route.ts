import { CheckoutError, placeOrderFromCart } from "@mlm/domain";
import { CheckoutPostSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { requireCustomerSession } from "@/lib/require-customer-session";
import { resolveRequestMarket } from "@/lib/request-market";

function checkoutErrorMessage(error: CheckoutError): string {
  switch (error.code) {
    case "EMPTY_CART":
      return "Cart is empty";
    case "MIXED_CURRENCY":
      return "Mixed currencies are not supported in one order";
    case "INCOMPLETE_SHIPPING_PROFILE":
      return error.message;
    case "UNSUPPORTED_PAYMENT_METHOD":
      return error.message;
    case "INVALID_SHIPPING_ADDRESS":
      return error.message;
    case "INVALID_COUPON":
    case "COUPON_USAGE_EXCEEDED":
    case "COUPON_VENDOR_MISMATCH":
    case "COUPON_CURRENCY_MISMATCH":
    case "INSUFFICIENT_WALLET_BALANCE":
      return error.message;
    default:
      return "Checkout failed";
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = await enforceUserRateLimit(request, auth.userId, "checkout-place", 10, 5 * 60 * 1000);
  if (limited) return limited;

  const raw = await request.json().catch(() => ({}));
  const parsed = CheckoutPostSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const market = await resolveRequestMarket();
    const order = await placeOrderFromCart(auth.userId, market.id, market.defaultCurrency, {
      paymentMethod: parsed.data.paymentMethod,
      idempotencyKey: parsed.data.idempotencyKey,
      shippingAddressId: parsed.data.shippingAddressId,
      couponCodes:
        parsed.data.couponCodes ??
        (parsed.data.couponCode ? [parsed.data.couponCode] : undefined),
      useWalletBalance: parsed.data.useWalletBalance,
    });
    return NextResponse.json(
      { order },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json(
        { error: checkoutErrorMessage(error), code: error.code },
        { status: 400 },
      );
    }
    throw error;
  }
}
