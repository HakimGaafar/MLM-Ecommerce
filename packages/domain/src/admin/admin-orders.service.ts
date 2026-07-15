import { Prisma } from "@mlm/db";
import type { OrderStatus, OrderUnitStatus, PaymentMethod, PaymentStatus } from "@mlm/db";
import { prisma } from "@mlm/db";
import { assertInvoiceGate } from "../invoices/order-invoice.service";
import {
  completeAllFulfillmentGroups,
  countPendingFulfillmentGroups,
  listAdminWarehouseFulfillmentGroups,
  type FulfillmentGroupDto,
} from "../orders/order-fulfillment-groups.service";
import { listOrderAdminNotes, type OrderAdminNoteDto } from "../orders/order-admin-notes.service";
import { listOrderCustomerNotices, type OrderCustomerNoticeDto } from "../orders/order-customer-notice.service";
import { listOrderEscalations, type OrderEscalationDto } from "../orders/order-escalation.service";
import {
  listBlockingFulfillmentGroups,
  type BlockingFulfillmentGroupDto,
} from "../orders/order-stuck.service";
import {
  listOrderVendorCancellations,
  type OrderVendorCancellationDto,
} from "../orders/order-vendor-cancel.service";
import { getFulfillmentSlaConfig } from "../orders/fulfillment-sla";
import { scheduleFinalizeOrderRewards } from "../wallet/wallet-jobs.service";

export type AdminOrderListItemDto = {
  orderId: string;
  orderNo: string;
  status: OrderStatus;
  createdAt: string;
  buyerName: string;
  buyerEmail: string;
  totalAmount: string;
  currency: string;
  lineCount: number;
  vendorCount: number;
};

export type AdminOrderLineDto = {
  id: string;
  vendorId: string;
  vendorName: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitIndex: number | null;
  unitLabel: string | null;
  unitStatus: OrderUnitStatus;
  unitPrice: string;
  lineTotal: string;
  vendorFulfillmentStatus: OrderStatus;
  vendorFulfillmentUpdatedAt: string;
};

export type AdminOrderShippingDto = {
  recipientName: string;
  phone: string;
  countryCode: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2?: string;
} | null;

export type AdminOrderDetailDto = {
  orderId: string;
  orderNo: string;
  status: OrderStatus;
  createdAt: string;
  buyerName: string;
  buyerEmail: string;
  shipping: AdminOrderShippingDto;
  lines: AdminOrderLineDto[];
  canUpdateStatus: boolean;
  canMarkCompleted: boolean;
  pendingVendorLines: number;
  /** True when the order includes line items from two or more vendors. */
  isMultiVendorOrder: boolean;
  subtotal: string;
  shippingFee: string;
  discountTotal: string;
  vatTotal: string;
  totalAmount: string;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentMethodDisplay: PaymentMethod | "WALLET_COVERED";
  paymentStatus: PaymentStatus;
  invoicesAvailable: boolean;
  warehouseFulfillmentGroups: FulfillmentGroupDto[];
  pendingFulfillmentGroups: number;
  blockingGroups: BlockingFulfillmentGroupDto[];
  escalations: OrderEscalationDto[];
  adminNotes: OrderAdminNoteDto[];
  customerNotices: OrderCustomerNoticeDto[];
  vendorCancellations: OrderVendorCancellationDto[];
  orderVendors: { vendorId: string; vendorName: string; hasActiveItems: boolean; cancelled: boolean }[];
  canCancelVendor: boolean;
  slaConfig: ReturnType<typeof getFulfillmentSlaConfig>;
};

export class AdminOrderError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "INVALID_TRANSITION", message?: string) {
    super(message ?? code);
    this.name = "AdminOrderError";
  }
}

const ALLOWED: Partial<Record<OrderStatus, OrderStatus[]>> = {
  NEW: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

function shippingFromOrder(row: {
  shippingAddressLine1: string | null;
  shippingRecipientName: string | null;
  shippingPhone: string | null;
  shippingCountryCode: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  shippingAddressLine2: string | null;
}): AdminOrderShippingDto {
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

function canAdminTransitionFrom(status: OrderStatus): boolean {
  const next = ALLOWED[status];
  return Boolean(next && next.length > 0);
}

function activeVendorIdsFromItems(
  items: Array<{ vendorId: string; unitStatus: OrderUnitStatus }>,
): Set<string> {
  const active = items.filter((item) => item.unitStatus !== "CANCELLED").map((item) => item.vendorId);
  if (active.length > 0) {
    return new Set(active);
  }
  return new Set(items.map((item) => item.vendorId));
}

export async function listAdminOrders(params: {
  page: number;
  pageSize: number;
  marketId: string;
}): Promise<{
  items: AdminOrderListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(50, Math.max(1, params.pageSize));
  const skip = (page - 1) * pageSize;

  const [orderRows, total] = await prisma.$transaction([
    prisma.order.findMany({
      where: { marketId: params.marketId },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        buyer: { select: { name: true, email: true } },
        items: {
          select: {
            vendorId: true,
            unitStatus: true,
            product: { select: { currency: true } },
          },
        },
      },
    }),
    prisma.order.count({ where: { marketId: params.marketId } }),
  ]);

  const items: AdminOrderListItemDto[] = orderRows.map((o) => {
    const vendorIds = activeVendorIdsFromItems(o.items);
    let currency = "SAR";
    for (const li of o.items) {
      if (li.product?.currency) {
        currency = li.product.currency;
        break;
      }
    }
    return {
      orderId: o.id,
      orderNo: o.orderNo,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      buyerName: o.buyer.name,
      buyerEmail: o.buyer.email,
      totalAmount: o.totalAmount.toString(),
      currency,
      lineCount: o.items.length,
      vendorCount: vendorIds.size,
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: skip + orderRows.length < total,
  };
}

export async function getAdminOrderDetail(
  orderId: string,
  marketId: string,
): Promise<AdminOrderDetailDto | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, marketId },
    include: {
      buyer: { select: { name: true, email: true } },
      items: {
        orderBy: [{ unitIndex: "asc" }, { createdAt: "asc" }],
        include: { product: { select: { id: true, currency: true } } },
      },
    },
  });
  if (!order) return null;

  let currency = "SAR";
  const lines: AdminOrderLineDto[] = order.items.map((li) => {
    if (li.product?.currency) currency = li.product.currency;
    return {
      id: li.id,
      vendorId: li.vendorId,
      vendorName: li.vendorNameSnapshot,
      productId: li.productId,
      productName: li.productNameSnapshot,
      quantity: li.quantity,
      unitIndex: li.unitIndex,
      unitLabel: li.unitLabel,
      unitStatus: li.unitStatus,
      unitPrice: li.unitPrice.toString(),
      lineTotal: li.lineTotal.toString(),
      vendorFulfillmentStatus: li.vendorFulfillmentStatus,
      vendorFulfillmentUpdatedAt: li.vendorFulfillmentUpdatedAt.toISOString(),
    };
  });
  const vendorIds = activeVendorIdsFromItems(
    order.items.map((item) => ({ vendorId: item.vendorId, unitStatus: item.unitStatus })),
  );
  const isMultiVendorOrder = vendorIds.size >= 2;
  const pendingFulfillmentGroups = await countPendingFulfillmentGroups(orderId);
  const pendingVendorLines = pendingFulfillmentGroups;
  const canMarkCompleted =
    order.status === "SHIPPED" && pendingFulfillmentGroups === 0;
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
  const invoicesAvailable = await assertInvoiceGate(orderId);
  const warehouseFulfillmentGroups = await listAdminWarehouseFulfillmentGroups(orderId);
  const [
    blockingGroups,
    escalations,
    adminNotes,
    customerNotices,
    vendorCancellations,
  ] = await Promise.all([
    listBlockingFulfillmentGroups(orderId),
    listOrderEscalations(orderId),
    listOrderAdminNotes(orderId),
    listOrderCustomerNotices(orderId),
    listOrderVendorCancellations(orderId),
  ]);
  const cancelledVendorIds = new Set(
    vendorCancellations.filter((c) => c.status === "COMPLETED").map((c) => c.vendorId),
  );
  const orderVendors = [...vendorIds].map((vendorId) => {
    const name =
      order.items.find((i) => i.vendorId === vendorId)?.vendorNameSnapshot ?? vendorId;
    const hasActiveItems = order.items.some(
      (i) => i.vendorId === vendorId && i.unitStatus === "ACTIVE",
    );
    return {
      vendorId,
      vendorName: name,
      hasActiveItems,
      cancelled: cancelledVendorIds.has(vendorId),
    };
  });
  const canCancelVendor =
    isMultiVendorOrder &&
    order.status !== "COMPLETED" &&
    order.status !== "CANCELLED" &&
    orderVendors.some((v) => v.hasActiveItems && !v.cancelled);

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    buyerName: order.buyer.name,
    buyerEmail: order.buyer.email,
    shipping: shippingFromOrder(order),
    lines,
    canUpdateStatus: canAdminTransitionFrom(order.status),
    canMarkCompleted,
    pendingVendorLines,
    isMultiVendorOrder,
    subtotal: order.subtotal.toString(),
    shippingFee: order.shippingFee.toString(),
    discountTotal: order.discountTotal.toString(),
    vatTotal: order.vatTotal.toString(),
    totalAmount: order.totalAmount.toString(),
    currency,
    paymentMethod: order.paymentMethod,
    paymentMethodDisplay:
      remainingAmount.lte(0) && walletAppliedAmount.gt(0) ? "WALLET_COVERED" : order.paymentMethod,
    paymentStatus: order.paymentStatus,
    invoicesAvailable,
    warehouseFulfillmentGroups,
    pendingFulfillmentGroups,
    blockingGroups,
    escalations,
    adminNotes,
    customerNotices,
    vendorCancellations,
    orderVendors,
    canCancelVendor,
    slaConfig: getFulfillmentSlaConfig(),
  };
}

export async function updateAdminOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
  marketId: string,
): Promise<{ status: OrderStatus }> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, marketId },
    select: { id: true, status: true },
  });
  if (!order) {
    throw new AdminOrderError("NOT_FOUND", "Order not found");
  }

  const allowed = ALLOWED[order.status];
  if (!allowed?.includes(nextStatus)) {
    throw new AdminOrderError("INVALID_TRANSITION", "That status change is not allowed from the current state.");
  }
  if (nextStatus === "COMPLETED") {
    const pending = await countPendingFulfillmentGroups(orderId);
    if (pending > 0) {
      throw new AdminOrderError(
        "INVALID_TRANSITION",
        "Cannot complete this order until all fulfillment groups are shipped.",
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    if (nextStatus === "COMPLETED") {
      await completeAllFulfillmentGroups(orderId, tx);
    }
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: nextStatus,
        ...(nextStatus === "COMPLETED" ? { deliveredAt: new Date() } : {}),
      },
    });
  });

  if (nextStatus === "COMPLETED") {
    await scheduleFinalizeOrderRewards(orderId);
  }

  return { status: nextStatus };
}

/** Admin-only: set COD / order payment collection state (for ops and QA). */
export async function updateAdminOrderPaymentStatus(
  orderId: string,
  nextPaymentStatus: PaymentStatus,
  marketId: string,
): Promise<{ paymentStatus: PaymentStatus }> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, marketId },
    select: { id: true, status: true, paymentStatus: true },
  });
  if (!order) {
    throw new AdminOrderError("NOT_FOUND", "Order not found");
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
