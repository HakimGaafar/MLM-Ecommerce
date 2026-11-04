import { getStripeClient, stripeAmountForCurrency, stripeAmountFromDecimalString } from "../payments/stripe-client";

export class StripeRefundError extends Error {
  constructor(
    public readonly code: "NOT_CONFIGURED" | "NO_SESSION" | "REFUND_FAILED",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "StripeRefundError";
  }
}

/** Partial refund against the order's Stripe Checkout session. Throws on failure. */
export async function refundStripeOrderAmount(
  stripeCheckoutSessionId: string,
  refundAmount: string,
  currencyHint?: string,
): Promise<string> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    throw new StripeRefundError("NOT_CONFIGURED", "Stripe is not configured.");
  }
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(stripeCheckoutSessionId);
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!paymentIntentId) {
    throw new StripeRefundError("NO_SESSION", "No Stripe payment found for this order.");
  }

  const currency = (currencyHint || session.currency || "SAR").toUpperCase();
  const amountMinor = currencyHint
    ? stripeAmountForCurrency(refundAmount, currency)
    : stripeAmountFromDecimalString(refundAmount);

  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountMinor,
    });
    if (refund.status === "failed") {
      throw new StripeRefundError("REFUND_FAILED", "Stripe refund failed.");
    }
    return refund.id;
  } catch (e) {
    if (e instanceof StripeRefundError) throw e;
    const msg = e instanceof Error ? e.message : "Stripe refund failed.";
    throw new StripeRefundError("REFUND_FAILED", msg);
  }
}
