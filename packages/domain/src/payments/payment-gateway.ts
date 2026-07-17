import type { PlaceOrderInput } from "../customer/checkout.service";
import {
  confirmStripeCheckoutForBuyer,
  createStripeCheckoutSession,
} from "./stripe-checkout.service";
import { refundStripeOrderAmount } from "./stripe-refund.service";

export type PaymentGatewayId = "stripe" | "hyperpay" | "tap" | "myfatoorah";

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
      paidWithoutGateway: result.paidWithoutStripe,
    };
  },
  confirmCheckoutForBuyer: confirmStripeCheckoutForBuyer,
  refundOrderAmount: refundStripeOrderAmount,
};

/**
 * Provider registry. Stripe is installed now; the other IDs reserve stable
 * configuration values for future adapters without changing checkout callers.
 */
export function getPaymentGateway(
  requested = process.env.PAYMENT_GATEWAY?.trim().toLowerCase() || "stripe",
): PaymentGateway {
  if (requested === "stripe") return stripeGateway;
  throw new Error(
    `Payment gateway "${requested}" is not installed. Available gateway: stripe.`,
  );
}
