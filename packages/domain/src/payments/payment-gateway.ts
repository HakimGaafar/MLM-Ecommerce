import type { PlaceOrderInput } from "../customer/checkout.service";
import {
  listInstalledPaymentGateways,
  resolvePaymentGatewayId,
  type PaymentGatewayId,
  isTapConfigured,
} from "./payment-config";
import {
  confirmStripeCheckoutForBuyer,
  createStripeCheckoutSession,
} from "./stripe-checkout.service";
import { refundStripeOrderAmount, StripeRefundError } from "./stripe-refund.service";
import {
  confirmTapCheckoutForBuyer,
  createTapCheckoutSession,
  refundTapOrderAmount,
  TapRefundError,
} from "./tap-checkout.service";

export type { PaymentGatewayId } from "./payment-config";
export { listInstalledPaymentGateways, resolvePaymentGatewayId } from "./payment-config";

export type PaymentCheckoutResult = {
  checkoutUrl: string | null;
  orderId: string | null;
  providerReference: string | null;
  paidWithoutGateway?: boolean;
};

export interface PaymentGateway {
  readonly id: PaymentGatewayId;
  isConfigured(): boolean;
  createCheckout(
    buyerUserId: string,
    marketId: string,
    input: PlaceOrderInput,
    options: { appBaseUrl: string },
  ): Promise<PaymentCheckoutResult>;
  confirmCheckoutForBuyer(
    buyerUserId: string,
    providerReference: string,
  ): Promise<{ orderId: string }>;
  refundOrderAmount(providerReference: string, amount: string): Promise<string>;
}

const stripeGateway: PaymentGateway = {
  id: "stripe",
  isConfigured: () => Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
  async createCheckout(buyerUserId, marketId, input, options) {
    const result = await createStripeCheckoutSession(
      buyerUserId,
      marketId,
      input,
      options,
    );
    return {
      checkoutUrl: result.checkoutUrl,
      orderId: result.orderId,
      providerReference: result.sessionId,
      paidWithoutGateway: result.paidWithoutGateway,
    };
  },
  confirmCheckoutForBuyer: confirmStripeCheckoutForBuyer,
  refundOrderAmount: refundStripeOrderAmount,
};

const tapGateway: PaymentGateway = {
  id: "tap",
  isConfigured: () => isTapConfigured(),
  async createCheckout(buyerUserId, marketId, input, options) {
    const result = await createTapCheckoutSession(buyerUserId, marketId, input, options);
    return {
      checkoutUrl: result.checkoutUrl,
      orderId: result.orderId,
      providerReference: result.providerReference,
      paidWithoutGateway: result.paidWithoutGateway,
    };
  },
  confirmCheckoutForBuyer: confirmTapCheckoutForBuyer,
  refundOrderAmount: refundTapOrderAmount,
};

/**
 * Active PSP. Default is Tap. Stripe remains available when
 * PAYMENT_GATEWAY=stripe is set explicitly.
 */
export function getPaymentGateway(
  requested = process.env.PAYMENT_GATEWAY?.trim().toLowerCase() || "tap",
): PaymentGateway {
  const id = resolvePaymentGatewayId(requested);
  if (id === "tap") return tapGateway;
  if (id === "stripe") return stripeGateway;
  throw new Error(
    `Payment gateway "${requested}" is not installed. Available: ${listInstalledPaymentGateways().join(", ")}.`,
  );
}

/**
 * Refund against the PSP that originally charged the order (not the current env default).
 */
export async function refundOrderCardPayment(params: {
  tapChargeId?: string | null;
  stripeCheckoutSessionId?: string | null;
  amount: string;
}): Promise<string> {
  if (params.tapChargeId) {
    return refundTapOrderAmount(params.tapChargeId, params.amount);
  }
  if (params.stripeCheckoutSessionId) {
    return refundStripeOrderAmount(params.stripeCheckoutSessionId, params.amount);
  }
  throw new StripeRefundError(
    "NO_SESSION",
    "Card refund required but no card checkout reference is linked to this order.",
  );
}

export { StripeRefundError, TapRefundError };
