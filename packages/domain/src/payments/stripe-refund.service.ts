import { getStripeClient, stripeAmountFromDecimalString } from "../payments/stripe-client";

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

  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: stripeAmountFromDecimalString(refundAmount),
  });
  if (refund.status === "failed") {
    throw new StripeRefundError("REFUND_FAILED", "Stripe refund failed.");
  }
  return refund.id;
}
