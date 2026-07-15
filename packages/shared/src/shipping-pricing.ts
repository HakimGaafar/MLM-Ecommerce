/** Platform default shipping fees (SAR) — Phase IV matrix. */
export const SHIPPING_FEE_DIRECT_SAR = "15.00";
export const SHIPPING_FEE_WAREHOUSE_A_SAR = "0.00";
export const SHIPPING_FEE_WAREHOUSE_B_SAR = "20.00";

export type VendorShippingModeCode = "DIRECT" | "INDIRECT";
export type VendorIndirectFulfillmentCode = "FORSEIZ_STOCK" | "ON_ORDER";

export function defaultShippingFeeForMode(
  mode: VendorShippingModeCode,
  indirect: VendorIndirectFulfillmentCode | null | undefined,
): string {
  if (mode === "DIRECT") return SHIPPING_FEE_DIRECT_SAR;
  if (indirect === "FORSEIZ_STOCK") return SHIPPING_FEE_WAREHOUSE_A_SAR;
  if (indirect === "ON_ORDER") return SHIPPING_FEE_WAREHOUSE_B_SAR;
  return SHIPPING_FEE_DIRECT_SAR;
}
