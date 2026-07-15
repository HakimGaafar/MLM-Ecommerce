import type { OrderItem } from "@mlm/db";
import { CHECKOUT_VAT_RATE } from "@mlm/shared";
import { getVendorEligibleAmount } from "../wallet/vendor-earning.service";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

const VAT_RATE = Number.parseFloat(CHECKOUT_VAT_RATE);

export type VendorSaleInvoiceTotals = {
  subtotal: number;
  discountShare: number;
  shippingShare: number;
  vatTotal: number;
  totalAmount: number;
};

export type CommissionInvoiceTotals = {
  commissionSubtotal: number;
  vatTotal: number;
  totalAmount: number;
};

export function activeVendorItems<T extends Pick<OrderItem, "vendorId" | "lineTotal" | "unitStatus">>(
  items: T[],
  vendorId: string,
): T[] {
  return items.filter((i) => i.vendorId === vendorId && i.unitStatus !== "RETURNED");
}

export function vendorMerchandiseSubtotal(
  items: Pick<OrderItem, "vendorId" | "lineTotal" | "unitStatus">[],
  vendorId: string,
): number {
  return roundMoney(
    activeVendorItems(items, vendorId).reduce((sum, row) => sum + Number(row.lineTotal), 0),
  );
}

/** Proportional split of order-level discount/shipping/VAT for a vendor's active merchandise. */
export function calculateVendorSaleInvoiceTotals(params: {
  vendorId: string;
  items: Pick<OrderItem, "vendorId" | "lineTotal" | "unitStatus">[];
  orderSubtotal: number;
  orderDiscountTotal: number;
  orderShippingFee: number;
  orderVatTotal: number;
}): VendorSaleInvoiceTotals | null {
  const subtotal = vendorMerchandiseSubtotal(params.items, params.vendorId);
  if (subtotal <= 0) return null;

  const orderSubtotal = Math.max(params.orderSubtotal, 0);
  const ratio = orderSubtotal > 0 ? Math.min(1, subtotal / orderSubtotal) : 1;

  const discountShare = roundMoney(params.orderDiscountTotal * ratio);
  const shippingShare = roundMoney(params.orderShippingFee * ratio);
  const taxable = roundMoney(subtotal + shippingShare - discountShare);
  const vatTotal =
    params.orderVatTotal > 0 && orderSubtotal > 0
      ? roundMoney(params.orderVatTotal * ratio)
      : roundMoney(taxable * VAT_RATE);
  const totalAmount = roundMoney(taxable + vatTotal);

  return { subtotal, discountShare, shippingShare, vatTotal, totalAmount };
}

export function calculateCommissionInvoiceTotals(params: {
  vendorId: string;
  items: Pick<OrderItem, "vendorId" | "lineTotal" | "unitStatus">[];
  orderSubtotal: number;
  orderDiscountTotal: number;
  platformRate: number;
}): CommissionInvoiceTotals | null {
  const vendorLineTotal = vendorMerchandiseSubtotal(params.items, params.vendorId);
  if (vendorLineTotal <= 0) return null;

  const eligible = getVendorEligibleAmount({
    vendorLineTotal,
    orderSubtotal: params.orderSubtotal,
    orderDiscountTotal: params.orderDiscountTotal,
  });
  const { platformRate } = params;
  const commissionSubtotal = roundMoney(eligible * platformRate);
  if (commissionSubtotal <= 0) return null;

  const vatTotal = roundMoney(commissionSubtotal * VAT_RATE);
  const totalAmount = roundMoney(commissionSubtotal + vatTotal);
  return { commissionSubtotal, vatTotal, totalAmount };
}

export function buildInvoiceNo(prefix: string, orderNo: string, vendorId: string): string {
  const suffix = vendorId.slice(-6).toUpperCase();
  return `${prefix}-${orderNo}-${suffix}`;
}
