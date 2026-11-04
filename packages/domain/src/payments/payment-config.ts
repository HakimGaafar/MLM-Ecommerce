/**
 * Active card PSP selection. Stripe remains in the repo but is inactive
 * unless PAYMENT_GATEWAY=stripe. Default is Tap.
 */
export type PaymentGatewayId = "stripe" | "tap" | "hyperpay" | "myfatoorah";

const INSTALLED: PaymentGatewayId[] = ["tap", "stripe"];

export function resolvePaymentGatewayId(
  requested = process.env.PAYMENT_GATEWAY?.trim().toLowerCase() || "tap",
): PaymentGatewayId {
  if (
    requested === "stripe" ||
    requested === "tap" ||
    requested === "hyperpay" ||
    requested === "myfatoorah"
  ) {
    return requested;
  }
  return "tap";
}

export function listInstalledPaymentGateways(): PaymentGatewayId[] {
  return [...INSTALLED];
}

/** True when the active gateway has credentials (card checkout may be offered). */
export function isOnlineCardPaymentConfigured(): boolean {
  const id = resolvePaymentGatewayId();
  if (id === "stripe") return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  if (id === "tap") return isTapConfigured();
  return false;
}

export function isTapConfigured(): boolean {
  return Boolean(process.env.TAP_SECRET_KEY?.trim());
}

export function isStripeExplicitlyEnabled(): boolean {
  return resolvePaymentGatewayId() === "stripe" && Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function isTapExplicitlyEnabled(): boolean {
  return resolvePaymentGatewayId() === "tap" && isTapConfigured();
}
