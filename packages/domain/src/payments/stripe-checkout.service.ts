import { randomUUID } from "node:crypto";
import type { PlaceOrderInput } from "../customer/checkout.service";
import {
  CheckoutError,
  createOrderFromCart,
  formatCheckoutMoneyAmount,
  getCheckoutQuoteForUser,
  resolveCheckoutShipping,
} from "../customer/checkout.service";
import { isUserEmailVerified } from "../auth/otp-verification.service";
import { assertShippingCountryMatchesMarket } from "../customer/delivery-market";
import { Prisma, isPrismaUniqueViolation, prisma } from "@mlm/db";
import { isStripeExplicitlyEnabled } from "./payment-config";
import {
  packCheckoutIntentMetadata,
  unpackCheckoutIntentMetadata,
} from "./checkout-intent-metadata";
import { getStripeClient, stripeAmountForCurrency } from "./stripe-client";
import { refundStripeOrderAmount, StripeRefundError } from "./stripe-refund.service";

export class StripeCheckoutError extends Error {
  constructor(
    public readonly code:
      | "NOT_CONFIGURED"
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "ALREADY_PAID"
      | "NOT_CANCELLABLE"
      | "SESSION_FAILED"
      | "AMOUNT_MISMATCH"
      | "AMOUNT_MISMATCH_REFUNDED"
      | "AMOUNT_MISMATCH_REFUND_FAILED",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "StripeCheckoutError";
  }
}

export type StripeCheckoutSessionResult = {
  checkoutUrl: string | null;
  /** null until the order is created (after successful payment). */
  orderId: string | null;
  sessionId: string | null;
  paidWithoutGateway?: boolean;
};

function appBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, "");
  if (!trimmed) throw new StripeCheckoutError("NOT_CONFIGURED", "APP_BASE_URL is not set.");
  return trimmed;
}

/**
 * Payment-first checkout: we do NOT create the order or clear the cart here.
 * We validate the checkout, compute the amount, and open a Stripe Checkout
 * session that carries the checkout intent in its metadata. The order is only
 * created once payment succeeds (see {@link createOrderFromStripeSession}), so
 * backing out of Stripe leaves the cart and checkout selections untouched.
 */
export async function createStripeCheckoutSession(
  buyerUserId: string,
  marketId: string,
  input: PlaceOrderInput,
  options: { appBaseUrl: string },
): Promise<StripeCheckoutSessionResult> {
  if (!isStripeExplicitlyEnabled()) {
    throw new StripeCheckoutError(
      "NOT_CONFIGURED",
      "Stripe is disabled. Set PAYMENT_GATEWAY=stripe and STRIPE_SECRET_KEY to re-enable.",
    );
  }

  if (!(await isUserEmailVerified(buyerUserId))) {
    throw new CheckoutError(
      "EMAIL_VERIFICATION_REQUIRED",
      "Verify your email with the one-time code before placing your first order.",
    );
  }
  if (input.settlementRiskAccepted !== true) {
    throw new CheckoutError(
      "SETTLEMENT_RISK_REQUIRED",
      "Accept FX, transfer fee, and customs risk terms to continue checkout.",
    );
  }
  if (input.acceptTerms !== true || input.acceptReturns !== true || input.acceptShipping !== true) {
    throw new CheckoutError(
      "POLICY_CONSENT_REQUIRED",
      "Accept Terms, Returns, and Shipping policies to continue checkout.",
    );
  }

  const stripe = getStripeClient();
  const base = appBaseUrl(options.appBaseUrl);

  // Fail before charging: a deliverable address must exist for this market.
  const shipping = await resolveCheckoutShipping(buyerUserId, marketId, input);
  assertShippingCountryMatchesMarket({
    countryCode: shipping.shippingCountryCode,
    marketId,
  });

  // Compute totals (also validates non-empty cart, single currency, coupons).
  const quote = await getCheckoutQuoteForUser(buyerUserId, marketId, {
    couponCode: input.couponCode,
    couponCodes: input.couponCodes,
    useWalletBalance: input.useWalletBalance,
    shippingAddressId: input.shippingAddressId,
    paymentCurrency: input.paymentCurrency,
  });
  if (!quote.cart.items.length) {
    throw new CheckoutError("EMPTY_CART");
  }

  const remaining = new Prisma.Decimal(quote.remainingAmount);

  // Wallet balance covers the whole order: no card payment needed, finalize now.
  if (remaining.lte(0)) {
    const orderId = await createOrderFromCart(buyerUserId, marketId, input, {
      method: "ONLINE_CARD",
      status: "PAID",
    });
    return {
      checkoutUrl: null,
      orderId,
      sessionId: null,
      paidWithoutGateway: true,
    };
  }

  const currencyCode = quote.paymentCurrency || quote.cart.currency || "SAR";
  const amountMinor = stripeAmountForCurrency(remaining.toFixed(2), currencyCode);

  const buyer = await prisma.user.findUnique({
    where: { id: buyerUserId },
    select: { email: true },
  });
  const idempotencyKey = input.idempotencyKey?.trim().slice(0, 120) || randomUUID();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: buyerUserId,
    customer_email: buyer?.email,
    metadata: packCheckoutIntentMetadata(input, {
      buyerUserId,
      marketId,
      idempotencyKey,
      chargedAmount: formatCheckoutMoneyAmount(remaining.toFixed(2), currencyCode),
      chargedCurrency: currencyCode.toUpperCase(),
    }),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: currencyCode.toLowerCase(),
          unit_amount: amountMinor,
          product_data: {
            name: "Marketplace order",
            description: "Vandsoq marketplace order",
          },
        },
      },
    ],
    success_url: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/checkout?cancelled=1`,
  });

  if (!session.url) {
    throw new StripeCheckoutError("SESSION_FAILED", "Stripe did not return a checkout URL.");
  }

  return { checkoutUrl: session.url, orderId: null, sessionId: session.id };
}

/**
 * Idempotent: creates the order from the buyer's cart once Stripe confirms the
 * payment. Safe to call concurrently from the success page and the webhook —
 * the unique `stripeCheckoutSessionId` constraint guarantees a single order.
 */
export async function createOrderFromStripeSession(sessionId: string): Promise<{
  orderId: string;
  alreadyPaid: boolean;
}> {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    throw new StripeCheckoutError("SESSION_FAILED", "Checkout session is not paid.");
  }

  const existing = await prisma.order.findUnique({
    where: { stripeCheckoutSessionId: sessionId },
    select: { id: true },
  });
  if (existing) {
    return { orderId: existing.id, alreadyPaid: true };
  }

  const { buyerUserId, marketId, input } = unpackCheckoutIntentMetadata(
    (session.metadata as Record<string, string> | null) ?? null,
  );
  const resolvedBuyerId = buyerUserId ?? session.client_reference_id ?? null;
  if (!resolvedBuyerId || !marketId) {
    throw new StripeCheckoutError("NOT_FOUND", "Checkout intent missing from Stripe session.");
  }

  const currency = (session.currency ?? "").toUpperCase();
  if (!currency || session.amount_total == null) {
    throw new StripeCheckoutError("AMOUNT_MISMATCH", "Stripe session is missing amount or currency.");
  }
  const factor = currency === "OMR" || currency === "BHD" || currency === "KWD" || currency === "JOD" ? 1000 : 100;
  const capturedCardAmount = formatCheckoutMoneyAmount(session.amount_total / factor, currency);

  try {
    const orderId = await createOrderFromCart(resolvedBuyerId, marketId, input, {
      method: "ONLINE_CARD",
      status: "PAID",
      stripeCheckoutSessionId: sessionId,
      capturedCardAmount,
      capturedCardCurrency: currency,
    });
    return { orderId, alreadyPaid: false };
  } catch (error) {
    if (error instanceof CheckoutError && error.code === "AMOUNT_MISMATCH") {
      await refundStripeSessionAfterAmountMismatch({
        sessionId,
        capturedCardAmount,
        currency,
      });
    }
    // Concurrent fulfillment (success page + webhook): the unique constraint on
    // stripeCheckoutSessionId (or checkoutIdempotencyKey) aborts the loser.
    if (isPrismaUniqueViolation(error)) {
      const created = await prisma.order.findUnique({
        where: { stripeCheckoutSessionId: sessionId },
        select: { id: true },
      });
      if (created) {
        return { orderId: created.id, alreadyPaid: true };
      }
    }
    throw error;
  }
}

/** Cart mismatch after Stripe pay → auto-refund full captured amount (never creates an order). */
async function refundStripeSessionAfterAmountMismatch(params: {
  sessionId: string;
  capturedCardAmount: string;
  currency: string;
}): Promise<never> {
  try {
    await refundStripeOrderAmount(params.sessionId, params.capturedCardAmount, params.currency);
  } catch (e) {
    const msg = e instanceof StripeRefundError || e instanceof Error ? e.message : "Stripe refund failed.";
    const already =
      /already.?refund|charge_already_refunded|has already been refunded/i.test(msg);
    if (already) {
      throw new StripeCheckoutError(
        "AMOUNT_MISMATCH_REFUNDED",
        "Cart changed after payment. The card charge was refunded.",
      );
    }
    throw new StripeCheckoutError(
      "AMOUNT_MISMATCH_REFUND_FAILED",
      `Cart changed after payment and automatic refund failed (${msg}). Contact support with session ${params.sessionId}.`,
    );
  }
  throw new StripeCheckoutError(
    "AMOUNT_MISMATCH_REFUNDED",
    "Cart changed after payment. The card charge was refunded.",
  );
}

export async function confirmStripeCheckoutForBuyer(
  buyerUserId: string,
  sessionId: string,
): Promise<{ orderId: string }> {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  const owner = (session.metadata?.buyerUserId as string | undefined) ?? session.client_reference_id;
  if (owner && owner !== buyerUserId) {
    throw new StripeCheckoutError("FORBIDDEN", "This checkout session does not belong to your account.");
  }
  if (session.payment_status !== "paid") {
    throw new StripeCheckoutError("SESSION_FAILED", "Payment has not completed yet.");
  }

  const result = await createOrderFromStripeSession(sessionId);
  return { orderId: result.orderId };
}

export async function handleStripeWebhookEvent(event: {
  id: string;
  type: string;
  data: { object: { id?: string; metadata?: Record<string, string> } };
}): Promise<{ duplicate: boolean }> {
  try {
    await prisma.stripeWebhookEvent.create({
      data: { id: event.id, type: event.type },
    });
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      return { duplicate: true };
    }
    throw error;
  }

  if (event.type === "checkout.session.completed") {
    const sessionId = event.data.object.id;
    if (sessionId) {
      await createOrderFromStripeSession(sessionId);
    }
    return { duplicate: false };
  }
  if (event.type === "checkout.session.expired") {
    return { duplicate: false };
  }

  return { duplicate: false };
}
