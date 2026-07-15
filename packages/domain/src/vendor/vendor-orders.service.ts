import { Prisma, prisma } from "@mlm/db";
import type { OrderStatus, OrderUnitStatus, PaymentStatus } from "@mlm/db";
import { isOrderInvoiceEligible } from "../orders/order-units.service";
import {
  listVendorFulfillmentGroups,
  updateVendorFulfillmentGroup,
  type FulfillmentGroupDto,
} from "../orders/order-fulfillment-groups.service";
import {
  listVendorEscalationBanners,
  type VendorEscalationBannerDto,
} from "../orders/order-escalation.service";
import { assertInvoiceGate } from "../invoices/order-invoice.service";
import type { ProductFulfillmentTypeCode } from "@mlm/shared";
import { vendorMayUpdateFulfillmentType } from "@mlm/shared";
import { scheduleFinalizeOrderRewards } from "../wallet/wallet-jobs.service";

export type VendorOrderListTab =
  | "all"
  | "completed"
  | "processing"
  | "pending"
  | "failed"
  | "canceled"
  | "refunded";

export type VendorOrderListItemDto = {
  orderId: string;
  orderNo: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  buyerName: string;
  buyerEmail: string;
  vendorSubtotal: string;
  currency: string;
  lineCount: number;
};

export type VendorOrderLineRatingDto = {
  productStars: number;
  vendorStars: number;
  deliveryStars: number;
  comment?: string;
  ratedAt: string;
};

export type VendorOrderLineDto = {
  id: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitIndex: number | null;
  unitLabel: string | null;
  unitStatus: OrderUnitStatus;
  unitPrice: string;
  lineTotal: string;
  fulfillmentType: ProductFulfillmentTypeCode;
  vendorFulfillmentStatus: OrderStatus;
  vendorFulfillmentUpdatedAt: string;
  rating: VendorOrderLineRatingDto | null;
};

export type VendorOrderShippingDto = {
  recipientName: string;
  phone: string;
  countryCode: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2?: string;
} | null;

export type VendorOrderDetailDto = {
  orderId: string;
  orderNo: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  paymentMethodDisplay: "COD" | "ONLINE_CARD" | "WALLET_COVERED";
  createdAt: string;
  buyerName: string;
  buyerEmail: string;
  shipping: VendorOrderShippingDto;
  lines: VendorOrderLineDto[];
  fulfillmentGroups: FulfillmentGroupDto[];
  canUpdateStatus: boolean;
  canUpdateLineStatus: boolean;
  canUpdateFulfillmentGroups: boolean;
  canUpdatePaymentStatus: boolean;
  /** True when the order includes line items from two or more vendors. */
  isMultiVendorOrder: boolean;
  vendorSubtotal: string;
  currency: string;
  commissionInvoiceEligible: boolean;
  commissionInvoiceAvailable: boolean;
  fulfillmentEscalations: VendorEscalationBannerDto[];
  vendorRemoval: { reason: string; createdAt: string } | null;
  fulfillmentView: "buttons" | "split" | "platform-handled" | "multi-vendor-group";
};

export class VendorOrderError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "MULTI_VENDOR"
      | "INVALID_TRANSITION"
      | "LINE_NOT_FOUND"
      | "ORDER_FINALIZED"
      | "FULFILLMENT_GROUP_REQUIRED",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "VendorOrderError";
  }
}

const ALLOWED: Partial<Record<OrderStatus, OrderStatus[]>> = {
  NEW: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: [],
  COMPLETED: [],
  CANCELLED: [],
};

const LINE_ALLOWED: Partial<Record<OrderStatus, OrderStatus[]>> = {
  NEW: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: [],
  COMPLETED: [],
  CANCELLED: [],
};

function activeVendorIdsFromItems(
  items: Array<{ vendorId: string; unitStatus: OrderUnitStatus }>,
): Set<string> {
  const active = items.filter((item) => item.unitStatus !== "CANCELLED").map((item) => item.vendorId);
  if (active.length > 0) {
    return new Set(active);
  }
  // Fallback for legacy/edge rows where every item is cancelled.
  return new Set(items.map((item) => item.vendorId));
}

function shippingFromOrder(row: {
  shippingAddressLine1: string | null;
  shippingRecipientName: string | null;
  shippingPhone: string | null;
  shippingCountryCode: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  shippingAddressLine2: string | null;
}): VendorOrderShippingDto {
  if (!row.shippingAddressLine1) return null;
  return {
    recipientName: row.shippingRecipientName ?? "",
    phone: row.shippingPhone ?? "",
    countryCode: row.shippingCountryCode ?? "",
    city: row.shippingCity ?? "",
    postalCode: row.shippingPostalCode ?? "",
    addressLine1: row.shippingAddressLine1,
    addressLine2: row.shippingAddressLine2 ?? undefined,
  };
}

function orderTabFilter(tab: VendorOrderListTab): Prisma.OrderWhereInput {
  switch (tab) {
    case "completed":
      return { status: "COMPLETED" };
    case "processing":
      return { status: { in: ["PROCESSING", "SHIPPED"] } };
    case "pending":
      return { status: "NEW" };
    case "failed":
      return { paymentStatus: "FAILED" };
    case "canceled":
      return { status: "CANCELLED" };
    case "refunded":
      return { paymentStatus: "REFUNDED" };
    default:
      return {};
  }
}

function orderSearchFilter(q: string | undefined): Prisma.OrderWhereInput {
  const term = q?.trim();
  if (!term) return {};
  return {
    OR: [
      { orderNo: { contains: term, mode: "insensitive" } },
      { buyer: { name: { contains: term, mode: "insensitive" } } },
      { buyer: { email: { contains: term, mode: "insensitive" } } },
    ],
  };
}

export async function listVendorOrders(params: {
  vendorId: string;
  marketId: string;
  page: number;
  pageSize: number;
  tab?: VendorOrderListTab;
  q?: string;
}): Promise<{
  items: VendorOrderListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  filters: { tab: VendorOrderListTab; q: string };
}> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(50, Math.max(1, params.pageSize));
  const skip = (page - 1) * pageSize;
  const tab = params.tab ?? "all";
  const q = params.q?.trim() ?? "";

  const where: Prisma.OrderWhereInput = {
    marketId: params.marketId,
    items: { some: { vendorId: params.vendorId } },
    ...orderTabFilter(tab),
    ...orderSearchFilter(q || undefined),
  };

  const [orderRows, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        buyer: { select: { name: true, email: true } },
        items: {
          where: { vendorId: params.vendorId },
          select: {
            quantity: true,
            lineTotal: true,
            product: { select: { currency: true } },
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const items: VendorOrderListItemDto[] = orderRows.map((o) => {
    let sub = 0;
    let currency = "SAR";
    for (const li of o.items) {
      sub += Number(li.lineTotal);
      if (li.product?.currency) currency = li.product.currency;
    }
    return {
      orderId: o.id,
      orderNo: o.orderNo,
      status: o.status,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt.toISOString(),
      buyerName: o.buyer.name,
      buyerEmail: o.buyer.email,
      vendorSubtotal: (Math.round(sub * 100) / 100).toFixed(2),
      currency,
      lineCount: o.items.length,
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: skip + orderRows.length < total,
    filters: { tab, q },
  };
}

export async function getVendorOrderDetail(
  vendorId: string,
  orderId: string,
  marketId: string,
): Promise<VendorOrderDetailDto | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, marketId, items: { some: { vendorId } } },
    include: {
      buyer: { select: { name: true, email: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, currency: true } },
          rating: {
            select: {
              productStars: true,
              vendorStars: true,
              deliveryStars: true,
              comment: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  });
  if (!order) return null;

  const vendorIds = activeVendorIdsFromItems(
    order.items.map((item) => ({ vendorId: item.vendorId, unitStatus: item.unitStatus })),
  );
  const isMultiVendorOrder = vendorIds.size >= 2;
  const fulfillmentGroups = await listVendorFulfillmentGroups(vendorId, orderId);
  const vendorManagedGroups = fulfillmentGroups.filter((g) => g.canVendorUpdate);
  const canUpdateFulfillmentGroups =
    order.status !== "COMPLETED" &&
    order.status !== "CANCELLED" &&
    vendorManagedGroups.length > 0;
  const canUpdateStatus =
    !isMultiVendorOrder &&
    fulfillmentGroups.length === 1 &&
    vendorManagedGroups.length === 1;
  const canUpdateLineStatus = false;

  const myLines = order.items
    .filter((i) => i.vendorId === vendorId)
    .sort((a, b) => {
      const ai = a.unitIndex ?? 0;
      const bi = b.unitIndex ?? 0;
      if (ai !== bi) return ai - bi;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  let sub = 0;
  let currency = "SAR";
  const lines: VendorOrderLineDto[] = myLines.map((li) => {
    sub += Number(li.lineTotal);
    if (li.product?.currency) currency = li.product.currency;
    return {
      id: li.id,
      productId: li.productId,
      productName: li.productNameSnapshot,
      quantity: li.quantity,
      unitIndex: li.unitIndex,
      unitLabel: li.unitLabel,
      unitStatus: li.unitStatus,
      unitPrice: li.unitPrice.toString(),
      lineTotal: li.lineTotal.toString(),
      fulfillmentType: li.fulfillmentType as ProductFulfillmentTypeCode,
      vendorFulfillmentStatus: li.vendorFulfillmentStatus,
      vendorFulfillmentUpdatedAt: li.vendorFulfillmentUpdatedAt.toISOString(),
      rating: li.rating
        ? {
            productStars: li.rating.productStars,
            vendorStars: li.rating.vendorStars,
            deliveryStars: li.rating.deliveryStars,
            comment: li.rating.comment ?? undefined,
            ratedAt: li.rating.updatedAt.toISOString(),
          }
        : null,
    };
  });
  const walletPayment = await prisma.walletTransaction.aggregate({
    where: {
      userId: order.buyerUserId,
      entryType: "ORDER_PAYMENT",
      direction: "DEBIT",
      status: "APPROVED",
      referenceType: "order",
      referenceId: order.id,
    },
    _sum: { amount: true },
  });
  const walletAppliedAmount = walletPayment._sum.amount ?? new Prisma.Decimal(0);
  const remainingAmount = new Prisma.Decimal(order.totalAmount.toString()).sub(walletAppliedAmount);
  const commissionInvoiceEligible = await isOrderInvoiceEligible(order.id);
  const commissionInvoiceAvailable = await assertInvoiceGate(order.id);
  const fulfillmentEscalations = await listVendorEscalationBanners(vendorId, orderId);
  const vendorRemovalRow = await prisma.orderVendorCancellation.findFirst({
    where: { orderId, vendorId, status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
    select: { reason: true, createdAt: true },
  });

  let fulfillmentView: VendorOrderDetailDto["fulfillmentView"] = "split";
  if (vendorManagedGroups.length === 0) {
    fulfillmentView = "platform-handled";
  } else if (canUpdateStatus) {
    fulfillmentView = "buttons";
  } else if (isMultiVendorOrder && fulfillmentGroups.length === 1) {
    fulfillmentView = "multi-vendor-group";
  } else if (fulfillmentGroups.length > 1) {
    fulfillmentView = "split";
  } else if (fulfillmentGroups.length === 1) {
    fulfillmentView = "multi-vendor-group";
  }

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paymentMethodDisplay:
      remainingAmount.lte(0) && walletAppliedAmount.gt(0)
        ? "WALLET_COVERED"
        : (order.paymentMethod as "COD" | "ONLINE_CARD"),
    createdAt: order.createdAt.toISOString(),
    buyerName: order.buyer.name,
    buyerEmail: order.buyer.email,
    shipping: shippingFromOrder(order),
    lines,
    fulfillmentGroups,
    canUpdateStatus,
    canUpdateLineStatus,
    canUpdateFulfillmentGroups,
    canUpdatePaymentStatus: canUpdateStatus,
    isMultiVendorOrder,
    vendorSubtotal: (Math.round(sub * 100) / 100).toFixed(2),
    currency,
    commissionInvoiceEligible,
    commissionInvoiceAvailable,
    fulfillmentEscalations,
    vendorRemoval: vendorRemovalRow
      ? { reason: vendorRemovalRow.reason, createdAt: vendorRemovalRow.createdAt.toISOString() }
      : null,
    fulfillmentView,
  };
}

const VENDOR_SETTABLE_PAYMENT: PaymentStatus[] = ["PENDING", "PAID"];

/** Vendor may mark COD collection on single-vendor orders only (not REFUNDED/FAILED). */
export async function updateVendorOrderPaymentStatus(
  vendorId: string,
  orderId: string,
  nextPaymentStatus: PaymentStatus,
): Promise<{ paymentStatus: PaymentStatus }> {
  if (!VENDOR_SETTABLE_PAYMENT.includes(nextPaymentStatus)) {
    throw new VendorOrderError(
      "INVALID_TRANSITION",
      "Vendors can only set payment to Pending or Paid.",
    );
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, items: { some: { vendorId } } },
    include: { items: { select: { vendorId: true, unitStatus: true } } },
  });
  if (!order) {
    throw new VendorOrderError("NOT_FOUND", "Order not found");
  }

  const vendorIds = activeVendorIdsFromItems(order.items);
  if (vendorIds.size !== 1 || !vendorIds.has(vendorId)) {
    throw new VendorOrderError(
      "MULTI_VENDOR",
      "This order includes multiple vendors. Payment status is managed by the platform.",
    );
  }

  if (order.paymentStatus === nextPaymentStatus) {
    return { paymentStatus: order.paymentStatus };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus: nextPaymentStatus },
  });

  if (nextPaymentStatus === "PAID" && order.status === "COMPLETED") {
    await scheduleFinalizeOrderRewards(orderId);
  }

  return { paymentStatus: nextPaymentStatus };
}

export async function updateVendorOrderStatus(
  vendorId: string,
  orderId: string,
  nextStatus: OrderStatus,
): Promise<{ status: OrderStatus }> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, items: { some: { vendorId } } },
    include: { items: { select: { vendorId: true, unitStatus: true } } },
  });
  if (!order) {
    throw new VendorOrderError("NOT_FOUND", "Order not found");
  }

  const vendorIds = activeVendorIdsFromItems(order.items);
  if (vendorIds.size !== 1 || !vendorIds.has(vendorId)) {
    throw new VendorOrderError(
      "MULTI_VENDOR",
      "This order includes multiple vendors. Order status is coordinated by the platform.",
    );
  }

  const groups = await listVendorFulfillmentGroups(vendorId, orderId);
  const manageable = groups.filter((g) => vendorMayUpdateFulfillmentType(g.fulfillmentType));
  if (groups.length !== 1 || manageable.length !== 1) {
    throw new VendorOrderError(
      "FULFILLMENT_GROUP_REQUIRED",
      "Update fulfillment status per type (Direct / Warehouse B) instead of the whole order.",
    );
  }

  const result = await updateVendorFulfillmentGroup(
    vendorId,
    orderId,
    manageable[0].fulfillmentType,
    nextStatus,
  );
  const refreshed = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  return { status: refreshed?.status ?? result.fulfillmentStatus };
}

export async function updateVendorOrderLineStatus(
  vendorId: string,
  orderId: string,
  lineItemId: string,
  nextStatus: OrderStatus,
): Promise<{ lineItemId: string; lineStatus: OrderStatus }> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, items: { some: { vendorId } } },
    select: { id: true, status: true },
  });
  if (!order) {
    throw new VendorOrderError("NOT_FOUND", "Order not found");
  }
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    throw new VendorOrderError(
      "ORDER_FINALIZED",
      "This order is already finalized. Vendor line status can no longer be changed.",
    );
  }

  const line = await prisma.orderItem.findFirst({
    where: { id: lineItemId, orderId, vendorId },
    select: { id: true, fulfillmentType: true },
  });
  if (!line) {
    throw new VendorOrderError("LINE_NOT_FOUND", "Order line not found for this vendor.");
  }

  const result = await updateVendorFulfillmentGroup(
    vendorId,
    orderId,
    line.fulfillmentType as ProductFulfillmentTypeCode,
    nextStatus,
  );

  return { lineItemId: line.id, lineStatus: result.fulfillmentStatus };
}
