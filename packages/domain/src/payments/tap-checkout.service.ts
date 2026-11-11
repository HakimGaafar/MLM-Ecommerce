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
import { getCustomerProfile } from "../customer/profile.service";
import { Prisma, isPrismaUniqueViolation, prisma } from "@mlm/db";
import { isTapConfigured } from "./payment-config";
import {
  packCheckoutIntentMetadata,
  unpackCheckoutIntentMetadata,
} from "./checkout-intent-metadata";
import {
  createTapCharge,
  createTapRefund,
  formatTapAmount,
  getTapMerchantId,
  retrieveTapCharge,
  type TapChargeResponse,
} from "./tap-client";

export class TapCheckoutError extends Error {
  constructor(
    public readonly code:
      | "NOT_CONFIGURED"
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "ALREADY_PAID"
      | "SESSION_FAILED"
      | "NOT_IMPLEMENTED"
      | "PROFILE_INCOMPLETE"
      | "AMOUNT_MISMATCH"
      | "AMOUNT_MISMATCH_REFUNDED"
      | "AMOUNT_MISMATCH_REFUND_FAILED",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "TapCheckoutError";
  }
}

export class TapRefundError extends Error {
  constructor(
    public readonly code: "NOT_CONFIGURED" | "REFUND_FAILED",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "TapRefundError";
  }
}

export type TapCheckoutSessionResult = {
  checkoutUrl: string | null;
  orderId: string | null;
  providerReference: string | null;
  paidWithoutGateway?: boolean;
};

function appBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, "");
  if (!trimmed) throw new TapCheckoutError("NOT_CONFIGURED", "APP_BASE_URL is not set.");
  return trimmed;
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "Customer", last: "-" };
  if (parts.length === 1) return { first: parts[0]!, last: "-" };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

function parsePhone(phone: string): { country_code: string; number: string } {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) {
    throw new TapCheckoutError(
      "PROFILE_INCOMPLETE",
      "Add a valid phone number on your profile before paying by card.",
    );
  }
  if (digits.length > 10) {
    return {
      country_code: digits.slice(0, digits.length - 9),
      number: digits.slice(-9),
    };
  }
  // Local-looking number without country code — use Oman default only when 8–10 digits.
  return { country_code: "968", number: digits };
}

function isCaptured(charge: TapChargeResponse): boolean {
  return (charge.status ?? "").toUpperCase() === "CAPTURED";
}

/**
 * Payment-first Tap Charges flow (redirect + post URL).
 * Order is created only after CAPTURED (success redirect or webhook).
 */
export async function createTapCheckoutSession(
  buyerUserId: string,
  marketId: string,
  input: PlaceOrderInput,
  options: { appBaseUrl: string },
): Promise<TapCheckoutSessionResult> {
  if (!isTapConfigured()) {
    throw new TapCheckoutError(
      "NOT_CONFIGURED",
      "Tap is not configured (set TAP_SECRET_KEY).",
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

  const base = appBaseUrl(options.appBaseUrl);

  const shipping = await resolveCheckoutShipping(buyerUserId, marketId, input);
  assertShippingCountryMatchesMarket({
    countryCode: shipping.shippingCountryCode,
    marketId,
  });

  const quote = await getCheckoutQuoteForUser(buyerUserId, marketId, {
    couponCode: input.couponCode,
    couponCodes: input.couponCodes,
    useWalletBalance: input.useWalletBalance,
    shippingAddressId: input.shippingAddressId,
  });
  if (!quote.cart.items.length) {
    throw new CheckoutError("EMPTY_CART");
  }

  const remaining = new Prisma.Decimal(quote.remainingAmount);
  if (remaining.lte(0)) {
    const orderId = await createOrderFromCart(buyerUserId, marketId, input, {
      method: "ONLINE_CARD",
      status: "PAID",
    });
    return { checkoutUrl: null, orderId, providerReference: null, paidWithoutGateway: true };
  }

  const currency = quote.cart.currency.toUpperCase();
  const amountMajor = Number(formatTapAmount(remaining.toString(), currency));
  const idempotencyKey = input.idempotencyKey?.trim().slice(0, 120) || randomUUID();
  const profile = await getCustomerProfile(buyerUserId);
  const email = profile?.email?.trim();
  if (!email) {
    throw new TapCheckoutError(
      "PROFILE_INCOMPLETE",
      "Add an email on your profile before paying by card.",
    );
  }
  const phoneRaw = profile?.phone?.trim();
  if (!phoneRaw) {
    throw new TapCheckoutError(
      "PROFILE_INCOMPLETE",
      "Add a phone number on your profile before paying by card.",
    );
  }
  const { first, last } = splitName(profile?.name?.trim() || "Customer");
  const phone = parsePhone(phoneRaw);
  const merchantId = getTapMerchantId();

  let charge: TapChargeResponse;
  try {
    charge = await createTapCharge({
      amount: amountMajor,
      currency,
      threeDSecure: true,
      save_card: false,
      customer_initiated: true,
      description: `Order ${marketId}`.slice(0, 200),
      metadata: packCheckoutIntentMetadata(input, {
        buyerUserId,
        marketId,
        idempotencyKey,
        chargedAmount: formatTapAmount(amountMajor, currency),
        chargedCurrency: currency,
      }),
      reference: {
        transaction: idempotencyKey.slice(0, 64),
        order: `tap-${Date.now()}-${buyerUserId.slice(-6)}`.slice(0, 64),
      },
      receipt: { email: true, sms: false },
      customer: {
        first_name: first.slice(0, 64),
        last_name: last.slice(0, 64),
        email: email.slice(0, 120),
        phone,
      },
      ...(merchantId ? { merchant: { id: merchantId } } : {}),
      source: { id: process.env.TAP_SOURCE_ID?.trim() || "src_all" },
      post: { url: `${base}/api/v1/webhooks/tap` },
      redirect: { url: `${base}/checkout/success` },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Tap charge create failed.";
    throw new TapCheckoutError("SESSION_FAILED", msg);
  }

  const payUrl = charge.transaction?.url ?? null;
  if (!payUrl) {
    throw new TapCheckoutError(
      "SESSION_FAILED",
      charge.response?.message ||
        "Tap did not return a payment URL. Confirm currency / source with your Tap account.",
    );
  }

  return { checkoutUrl: payUrl, orderId: null, providerReference: charge.id };
}

/**
 * Idempotent: creates the order once Tap reports CAPTURED.
 * Safe from success redirect + webhook concurrency via unique tapChargeId.
 */
export async function createOrderFromTapCharge(chargeId: string): Promise<{
  orderId: string;
  alreadyPaid: boolean;
}> {
  const charge = await retrieveTapCharge(chargeId);
  if (!isCaptured(charge)) {
    throw new TapCheckoutError("SESSION_FAILED", "Tap charge is not captured yet.");
  }

  const existing = await prisma.order.findUnique({
    where: { tapChargeId: chargeId },
    select: { id: true },
  });
  if (existing) {
    return { orderId: existing.id, alreadyPaid: true };
  }

  const { buyerUserId, marketId, input } = unpackCheckoutIntentMetadata(
    (charge.metadata as Record<string, string> | null | undefined) ?? null,
  );
  if (!buyerUserId || !marketId) {
    throw new TapCheckoutError("NOT_FOUND", "Checkout intent missing from Tap charge metadata.");
  }

  const chargeCurrency = (charge.currency ?? "").toUpperCase();
  if (!chargeCurrency || charge.amount == null) {
    throw new TapCheckoutError("AMOUNT_MISMATCH", "Tap charge is missing amount or currency.");
  }
  const capturedCardAmount = formatCheckoutMoneyAmount(charge.amount, chargeCurrency);

  try {
    const orderId = await createOrderFromCart(buyerUserId, marketId, input, {
      method: "ONLINE_CARD",
      status: "PAID",
      tapChargeId: chargeId,
      capturedCardAmount,
      capturedCardCurrency: chargeCurrency,
    });
    return { orderId, alreadyPaid: false };
  } catch (error) {
    if (error instanceof CheckoutError && error.code === "AMOUNT_MISMATCH") {
      await refundTapChargeAfterAmountMismatch({
        chargeId,
        capturedCardAmount,
      });
    }
    if (isPrismaUniqueViolation(error)) {
      const created = await prisma.order.findUnique({
        where: { tapChargeId: chargeId },
        select: { id: true },
      });
      if (created) {
        return { orderId: created.id, alreadyPaid: true };
      }
    }
    throw error;
  }
}

/**
 * Cart no longer matches captured Tap charge → auto-refund (idempotent via webhook event row).
 * Always throws AMOUNT_MISMATCH_REFUNDED or AMOUNT_MISMATCH_REFUND_FAILED (never creates an order).
 */
async function refundTapChargeAfterAmountMismatch(params: {
  chargeId: string;
  capturedCardAmount: string;
}): Promise<never> {
  const refundEventId = `${params.chargeId}:AMOUNT_MISMATCH_REFUND`;
  const already = await prisma.tapWebhookEvent.findUnique({
    where: { id: refundEventId },
    select: { id: true },
  });
  if (already) {
    throw new TapCheckoutError(
      "AMOUNT_MISMATCH_REFUNDED",
      "Cart changed after payment. The card charge was refunded.",
    );
  }

  try {
    await refundTapOrderAmount(params.chargeId, params.capturedCardAmount);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Tap refund failed.";
    throw new TapCheckoutError(
      "AMOUNT_MISMATCH_REFUND_FAILED",
      `Cart changed after payment and automatic refund failed (${msg}). Contact support with charge ${params.chargeId}.`,
    );
  }

  try {
    await prisma.tapWebhookEvent.create({
      data: { id: refundEventId, type: "amount_mismatch_refund" },
    });
  } catch (e) {
    if (!isPrismaUniqueViolation(e)) throw e;
  }

  throw new TapCheckoutError(
    "AMOUNT_MISMATCH_REFUNDED",
    "Cart changed after payment. The card charge was refunded.",
  );
}

export async function confirmTapCheckoutForBuyer(
  buyerUserId: string,
  chargeId: string,
): Promise<{ orderId: string }> {
  const charge = await retrieveTapCharge(chargeId);
  const owner = charge.metadata?.buyerUserId;
  if (owner && owner !== buyerUserId) {
    throw new TapCheckoutError("FORBIDDEN", "This Tap charge does not belong to your account.");
  }
  if (!isCaptured(charge)) {
    throw new TapCheckoutError("SESSION_FAILED", "Payment has not completed yet.");
  }
  const result = await createOrderFromTapCharge(chargeId);
  return { orderId: result.orderId };
}

export async function handleTapWebhookCharge(charge: TapChargeResponse): Promise<{
  duplicate: boolean;
  orderId?: string;
}> {
  const status = (charge.status ?? "unknown").toUpperCase();
  const eventId = `${charge.id}:${status}`;

  // Non-CAPTURED: record for observability only (does not block a later CAPTURED).
  if (!isCaptured(charge)) {
    try {
      await prisma.tapWebhookEvent.create({
        data: { id: eventId, type: charge.status ?? "charge" },
      });
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        return { duplicate: true };
      }
      throw error;
    }
    return { duplicate: false };
  }

  // CAPTURED: create order first, then mark processed — so a failed create can retry.
  try {
    const result = await createOrderFromTapCharge(charge.id);
    try {
      await prisma.tapWebhookEvent.create({
        data: { id: eventId, type: charge.status ?? "charge" },
      });
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        return { duplicate: true, orderId: result.orderId };
      }
      throw error;
    }
    return { duplicate: false, orderId: result.orderId };
  } catch (error) {
    // Refund already issued for cart mismatch — stop webhook retries.
    if (error instanceof TapCheckoutError && error.code === "AMOUNT_MISMATCH_REFUNDED") {
      try {
        await prisma.tapWebhookEvent.create({
          data: { id: eventId, type: "captured_amount_mismatch_refunded" },
        });
      } catch (insertError) {
        if (!isPrismaUniqueViolation(insertError)) throw insertError;
      }
      return { duplicate: false };
    }
    // Refund failed — leave CAPTURED unmarked so Tap can retry.
    throw error;
  }
}

export async function refundTapOrderAmount(
  chargeId: string,
  amount: string,
): Promise<string> {
  if (!isTapConfigured()) {
    throw new TapRefundError("NOT_CONFIGURED", "Tap is not configured.");
  }
  try {
    const charge = await retrieveTapCharge(chargeId);
    const currency = (charge.currency ?? "SAR").toUpperCase();
    const refund = await createTapRefund({
      chargeId,
      amount: Number.parseFloat(amount),
      currency,
    });
    return refund.id;
  } catch (e) {
    if (e instanceof TapRefundError) throw e;
    const msg = e instanceof Error ? e.message : "Tap refund failed.";
    throw new TapRefundError("REFUND_FAILED", msg);
  }
}
