import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
}

/** Stripe amount in the currency's smallest unit (OMR uses 3 decimals). */
export function stripeAmountForCurrency(amount: string, currency: string): number {
  const n = Number.parseFloat(amount);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Invalid amount for Stripe.");
  }
  const code = currency.trim().toUpperCase();
  const factor = code === "OMR" ? 1000 : 100;
  return Math.round(n * factor);
}

/** @deprecated Use stripeAmountForCurrency — assumes 2-decimal currency. */
export function stripeAmountFromDecimalString(amount: string): number {
  return stripeAmountForCurrency(amount, "SAR");
}
