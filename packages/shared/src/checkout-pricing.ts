/** @deprecated Use per-vendor shipping (Phase IV). Kept as direct-mode default. */
export const CHECKOUT_FLAT_SHIPPING_SAR = "15.00";

export { SHIPPING_FEE_DIRECT_SAR, SHIPPING_FEE_WAREHOUSE_A_SAR, SHIPPING_FEE_WAREHOUSE_B_SAR } from "./shipping-pricing";

/** VAT rate applied to (subtotal + shipping − discount); Saudi standard 15%. */
export const CHECKOUT_VAT_RATE = "0.15";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Matches server checkout money math for display (two decimal places).
 */
export function previewCheckoutTotalsFromSubtotalString(
  subtotal: string,
  discountTotal = "0",
  shippingFee = CHECKOUT_FLAT_SHIPPING_SAR,
  vatRate = CHECKOUT_VAT_RATE,
): {
  subtotal: string;
  shippingFee: string;
  discountTotal: string;
  vatTotal: string;
  totalAmount: string;
} {
  const sub = round2(Number.parseFloat(subtotal) || 0);
  const ship = round2(Number.parseFloat(shippingFee) || 0);
  const disc = round2(Math.max(0, Number.parseFloat(discountTotal) || 0));
  const taxable = round2(Math.max(0, sub + ship - disc));
  const vat = round2(taxable * Number.parseFloat(vatRate));
  const total = round2(taxable + vat);
  return {
    subtotal: sub.toFixed(2),
    shippingFee: ship.toFixed(2),
    discountTotal: disc.toFixed(2),
    vatTotal: vat.toFixed(2),
    totalAmount: total.toFixed(2),
  };
}
