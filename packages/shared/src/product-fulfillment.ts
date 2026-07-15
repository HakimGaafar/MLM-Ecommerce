import {
  SHIPPING_FEE_DIRECT_SAR,
  SHIPPING_FEE_WAREHOUSE_A_SAR,
  SHIPPING_FEE_WAREHOUSE_B_SAR,
  type VendorIndirectFulfillmentCode,
  type VendorShippingModeCode,
} from "./shipping-pricing";
import { z } from "zod";

export const PRODUCT_FULFILLMENT_TYPES = ["DIRECT", "FORSEIZ_STOCK", "ON_ORDER"] as const;

export const ProductFulfillmentTypeSchema = z.enum(PRODUCT_FULFILLMENT_TYPES);

export type ProductFulfillmentTypeCode = (typeof PRODUCT_FULFILLMENT_TYPES)[number];

export function defaultFulfillmentFromVendorProfile(
  mode: VendorShippingModeCode,
  indirect: VendorIndirectFulfillmentCode | null | undefined,
): ProductFulfillmentTypeCode {
  if (mode === "DIRECT") return "DIRECT";
  if (indirect === "ON_ORDER") return "ON_ORDER";
  return "FORSEIZ_STOCK";
}

export function defaultShippingFeeForFulfillmentType(type: ProductFulfillmentTypeCode): string {
  if (type === "DIRECT") return SHIPPING_FEE_DIRECT_SAR;
  if (type === "FORSEIZ_STOCK") return SHIPPING_FEE_WAREHOUSE_A_SAR;
  return SHIPPING_FEE_WAREHOUSE_B_SAR;
}

export function fulfillmentTypeToVendorShipping(type: ProductFulfillmentTypeCode): {
  shippingMode: VendorShippingModeCode;
  indirectFulfillment: VendorIndirectFulfillmentCode | null;
} {
  if (type === "DIRECT") {
    return { shippingMode: "DIRECT", indirectFulfillment: null };
  }
  return { shippingMode: "INDIRECT", indirectFulfillment: type };
}

/** Vendor may advance fulfillment for Direct and Warehouse B (on-order). */
export function vendorMayUpdateFulfillmentType(type: ProductFulfillmentTypeCode): boolean {
  return type === "DIRECT" || type === "ON_ORDER";
}

/** Platform ops advance Warehouse A (Forseiz stock) fulfillment. */
export function adminMayUpdateFulfillmentType(type: ProductFulfillmentTypeCode): boolean {
  return type === "FORSEIZ_STOCK";
}
