import {
  type Order,
  type OrderItem,
  type OrderReturnStatus,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
  Prisma,
  prisma,
} from "@mlm/db";
import {
  getOrderItemRatingsForOrder,
  isOrderEligibleForRatings,
  type OrderItemRatingDto,
} from "./order-item-ratings.service";
import { isMarketCode, type MarketCode } from "@mlm/shared";
import { returnWindowDays as defaultReturnWindowDays } from "../business-rules";
import { getReturnWindowDays } from "../platform-config/platform-config.service";
import { listReturnableUnitsForOrder, isOrderInvoiceEligible } from "../orders/order-units.service";
import { assertInvoiceGate } from "../invoices/order-invoice.service";
import { listActiveCustomerNotices } from "../orders/order-customer-notice.service";

/** Customer-facing lifecycle label (maps from `OrderStatus`). */
export type CustomerOrderCustomerStep = "UNDER_REVIEW" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export type CustomerOrderLineItemRatingDto = {
  productStars: number;
  vendorStars: number;
  deliveryStars: number;
  comment?: string;
  updatedAt: string;
};

export type CustomerOrderLineItemDto = {
  id: string;
  productId: string | null;
  vendorId: string;
  productName: string;
  vendorName: string;
  quantity: number;
  unitIndex: number | null;
  unitLabel: string | null;
  unitStatus: string;
  unitPrice: string;
  lineTotal: string;
  /** True when the order is completed and paid — buyer may submit or update a rating for this line. */
  canRate: boolean;
  rating: CustomerOrderLineItemRatingDto | null;
};

export type CustomerOrderShippingSnapshotDto = {
  recipientName: string;
  phone: string;
  countryCode: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2?: string;
};

export type CustomerOrderVendorShippingDto = {
  vendorId: string;
  vendorName: string;
  fulfillmentType: string;
  shippingMode: string;
  indirectFulfillment: string | null;
  fee: string;
};

export type CustomerOrderListItemDto = {
  id: string;
  orderNo: string;
  status: OrderStatus;
  customerStep: CustomerOrderCustomerStep;
  currency: string;
  subtotal: string;
  shippingFee: string;
  discountTotal: string;
  vatTotal: string;
  totalAmount: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
};

export type CustomerOrderDetailDto = CustomerOrderListItemDto & {
  lineItems: CustomerOrderLineItemDto[];
  shipping: CustomerOrderShippingSnapshotDto | null;
  shippingBreakdown: CustomerOrderVendorShippingDto[];
  deliveredAt: string | null;
  /** From payment until 15 days after delivery (see `deliveredAt`); COD-friendly. */
  canRequestReturn: boolean;
  /** Open return case exists (blocks a second request). */
  hasOpenReturn: boolean;
  /** Id of blocking return, if any. */
  activeReturnId: string | null;
  /** Units still eligible for a new return request. */
  returnableUnitCount: number;
  /** True when order is completed, paid, and delivered (invoice prerequisite). */
  invoiceEligible: boolean;
  /** True after return window closes with no open returns (Phase III invoicing gate). */
  finalInvoiceAllowed: boolean;
  walletAppliedAmount: string;
  remainingAmount: string;
  paymentMethodDisplay: "COD" | "ONLINE_CARD" | "WALLET_COVERED";
  customerNotices: { id: string; type: string; body: string; createdAt: string }[];
};

const STATUS_FILTER_MAP: Record<string, OrderStatus> = {
  new: "NEW",
  processing: "PROCESSING",
  shipped: "SHIPPED",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
};

function customerStepFromStatus(status: OrderStatus): CustomerOrderCustomerStep {
  switch (status) {
    case "NEW":
      return "UNDER_REVIEW";
    case "PROCESSING":
      return "PREPARING";
    case "SHIPPED":
      return "SHIPPED";
    case "COMPLETED":
      return "DELIVERED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "UNDER_REVIEW";
  }
}

/** Eligible from paid until N days after delivery; before `deliveredAt`, allowed while order is open (not cancelled). */
function computeCanRequestReturn(
  row: Pick<Order, "status" | "paymentStatus" | "deliveredAt" | "updatedAt">,
  returnWindowDays: number,
): boolean {
  if (row.status === "CANCELLED") return false;
  if (row.paymentStatus !== "PAID") return false;

  const deliveryMoment = row.deliveredAt ?? (row.status === "COMPLETED" ? row.updatedAt : null);
  if (!deliveryMoment) {
    return row.status === "NEW" || row.status === "PROCESSING" || row.status === "SHIPPED" || row.status === "COMPLETED";
  }

  const deadline = new Date(deliveryMoment);
  deadline.setUTCDate(deadline.getUTCDate() + returnWindowDays);
  return Date.now() <= deadline.getTime();
}

/** Exported for return creation rules (same as order detail `canRequestReturn` before open-return check). */
export async function isOrderEligibleForReturn(
  row: Pick<Order, "status" | "paymentStatus" | "deliveredAt" | "updatedAt" | "marketId">,
): Promise<boolean> {
  const returnWindowDays = await getReturnWindowDays(row.marketId);
  return computeCanRequestReturn(row, returnWindowDays);
}

function parseYmdUtcStart(s: string): Date | null {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseYmdUtcEnd(s: string): Date | null {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function lineItemRatingToDto(r: OrderItemRatingDto): CustomerOrderLineItemRatingDto {
  return {
    productStars: r.productStars,
    vendorStars: r.vendorStars,
    deliveryStars: r.deliveryStars,
    comment: r.comment,
    updatedAt: r.updatedAt,
  };
}

function lineItemToDto(row: OrderItem, opts: { canRate: boolean; rating: OrderItemRatingDto | undefined }): CustomerOrderLineItemDto {
  return {
    id: row.id,
    productId: row.productId,
    vendorId: row.vendorId,
    productName: row.productNameSnapshot,
    vendorName: row.vendorNameSnapshot,
    quantity: row.quantity,
    unitIndex: row.unitIndex,
    unitLabel: row.unitLabel,
    unitStatus: row.unitStatus,
    unitPrice: row.unitPrice.toString(),
    lineTotal: row.lineTotal.toString(),
    canRate: opts.canRate,
    rating: opts.rating ? lineItemRatingToDto(opts.rating) : null,
  };
}

function shippingFromOrder(row: Order): CustomerOrderShippingSnapshotDto | null {
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

function orderToListDto(row: Order, currency: string): CustomerOrderListItemDto {
  return {
    id: row.id,
    orderNo: row.orderNo,
    status: row.status,
    customerStep: customerStepFromStatus(row.status),
    currency,
    subtotal: row.subtotal.toString(),
    shippingFee: row.shippingFee.toString(),
    discountTotal: row.discountTotal.toString(),
    vatTotal: row.vatTotal.toString(),
    totalAmount: row.totalAmount.toString(),
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const RETURN_STATUSES_BLOCKING_NEW: OrderReturnStatus[] = [
  "REQUESTED",
  "RECEIPT_IN_PROGRESS",
  "RECEIPT_COMPLETED",
  "PROCESSING_IN_PROGRESS",
  "PROCESSING_COMPLETED",
  "REFUND_IN_PROGRESS",
];

function orderToDetailDto(
  row: Order & {
    items: OrderItem[];
    vendorShippingLines?: {
      vendorId: string;
      vendorNameSnapshot: string;
      fulfillmentType: string;
      shippingMode: string;
      indirectFulfillment: string | null;
      fee: Prisma.Decimal;
    }[];
    invoiceEligible: boolean;
    finalInvoiceAllowed: boolean;
  },
  activeReturn: { id: string } | null,
  ratingsByLineId: Map<string, OrderItemRatingDto>,
  walletAppliedAmount: string,
  returnableUnitCount: number,
  customerNotices: { id: string; type: string; body: string; createdAt: string }[],
  returnWindowDays: number,
  defaultCurrency: string,
): CustomerOrderDetailDto {
  const hasOpenReturn = Boolean(activeReturn);
  const canRate = isOrderEligibleForRatings(row);
  const remaining = Prisma.Decimal.max(
    new Prisma.Decimal(row.totalAmount.toString()).sub(new Prisma.Decimal(walletAppliedAmount)),
    new Prisma.Decimal(0),
  );
  const sortedItems = [...row.items].sort((a, b) => {
    const ai = a.unitIndex ?? 0;
    const bi = b.unitIndex ?? 0;
    if (ai !== bi) return ai - bi;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return {
    ...orderToListDto(row, defaultCurrency),
    lineItems: sortedItems.map((item) =>
      lineItemToDto(item, { canRate, rating: ratingsByLineId.get(item.id) }),
    ),
    shipping: shippingFromOrder(row),
    shippingBreakdown: (row.vendorShippingLines ?? []).map((line) => ({
      vendorId: line.vendorId,
      vendorName: line.vendorNameSnapshot,
      fulfillmentType: line.fulfillmentType,
      shippingMode: line.shippingMode,
      indirectFulfillment: line.indirectFulfillment,
      fee: line.fee.toString(),
    })),
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    canRequestReturn: computeCanRequestReturn(row, returnWindowDays) && !hasOpenReturn && returnableUnitCount > 0,
    hasOpenReturn,
    activeReturnId: activeReturn?.id ?? null,
    returnableUnitCount,
    invoiceEligible: row.invoiceEligible,
    finalInvoiceAllowed: row.finalInvoiceAllowed,
    walletAppliedAmount,
    remainingAmount: remaining.toFixed(2),
    paymentMethodDisplay:
      remaining.eq(0) && new Prisma.Decimal(walletAppliedAmount).gt(0)
        ? "WALLET_COVERED"
        : (row.paymentMethod as "COD" | "ONLINE_CARD"),
    customerNotices,
  };
}

export async function getCustomerOrderForBuyer(
  buyerUserId: string,
  orderId: string,
  marketId: string,
  defaultCurrency = "SAR",
): Promise<CustomerOrderDetailDto | null> {
  const row = await prisma.order.findFirst({
    where: { id: orderId, buyerUserId, marketId },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      vendorShippingLines: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) return null;

  const activeReturn = await prisma.orderReturn.findFirst({
    where: {
      orderId: row.id,
      status: { in: RETURN_STATUSES_BLOCKING_NEW },
    },
    select: { id: true },
  });

  const ratingsByLineId = await getOrderItemRatingsForOrder(row.id);
  const walletPayment = await prisma.walletTransaction.aggregate({
    where: {
      userId: buyerUserId,
      entryType: "ORDER_PAYMENT",
      direction: "DEBIT",
      status: "APPROVED",
      referenceType: "order",
      referenceId: row.id,
    },
    _sum: { amount: true },
  });
  const walletAppliedAmount = (walletPayment._sum.amount ?? new Prisma.Decimal(0)).toFixed(2);

  const returnableUnits = await listReturnableUnitsForOrder(row.id);
  const invoiceEligible = await isOrderInvoiceEligible(row.id);
  const finalInvoiceAllowed = await assertInvoiceGate(row.id);
  const customerNotices = await listActiveCustomerNotices(row.id);
  const returnWindowDays = await getReturnWindowDays(marketId);
  const orderRow = { ...row, invoiceEligible, finalInvoiceAllowed };

  return orderToDetailDto(
    orderRow,
    activeReturn,
    ratingsByLineId,
    walletAppliedAmount,
    returnableUnits.length,
    customerNotices,
    returnWindowDays,
    defaultCurrency,
  );
}

export async function listCustomerOrdersForBuyer(params: {
  buyerUserId: string;
  marketId: string;
  defaultCurrency?: string;
  statusFilter: string;
  dateRange: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  page: number;
  pageSize: number;
}): Promise<{
  items: CustomerOrderListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const defaultCurrency = params.defaultCurrency ?? "SAR";
  const where: Prisma.OrderWhereInput = {
    buyerUserId: params.buyerUserId,
    marketId: params.marketId,
  };

  const normalizedStatus = params.statusFilter.trim().toLowerCase();
  if (normalizedStatus !== "all") {
    const mapped = STATUS_FILTER_MAP[normalizedStatus];
    if (mapped) {
      where.status = mapped;
    }
  }

  const fromParam = params.dateFrom?.trim() ?? "";
  const toParam = params.dateTo?.trim() ?? "";
  if (fromParam && toParam) {
    const start = parseYmdUtcStart(fromParam);
    const end = parseYmdUtcEnd(toParam);
    if (start && end && start <= end) {
      const spanMs = end.getTime() - start.getTime();
      const maxSpan = 366 * 24 * 60 * 60 * 1000;
      if (spanMs <= maxSpan) {
        where.createdAt = { gte: start, lte: end };
      }
    }
  } else {
    const normalizedRange = params.dateRange.trim().toLowerCase();
    if (normalizedRange !== "all" && normalizedRange !== "custom") {
      const days = Number.parseInt(normalizedRange, 10);
      if (!Number.isNaN(days) && days > 0) {
        const from = new Date();
        from.setUTCDate(from.getUTCDate() - days);
        from.setUTCHours(0, 0, 0, 0);
        where.createdAt = { gte: from };
      }
    }
  }

  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const skip = (page - 1) * pageSize;

  const [rows, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items: rows.map((row) => orderToListDto(row, defaultCurrency)),
    total,
    page,
    pageSize,
    hasMore: skip + rows.length < total,
  };
}

export type CustomerOrderHomeMarket = {
  marketId: string;
  marketCode: MarketCode;
  marketNameEn: string;
  marketNameAr: string;
  marketSubdomain: string;
};

/** When an order exists for the buyer but not in the active market, returns its home market. */
export async function findCustomerOrderHomeMarket(
  buyerUserId: string,
  orderId: string,
): Promise<CustomerOrderHomeMarket | null> {
  const row = await prisma.order.findFirst({
    where: { id: orderId, buyerUserId },
    select: {
      marketId: true,
      market: {
        select: {
          code: true,
          nameEn: true,
          nameAr: true,
          subdomain: true,
        },
      },
    },
  });
  if (!row?.market || !isMarketCode(row.market.code)) return null;
  return {
    marketId: row.marketId,
    marketCode: row.market.code,
    marketNameEn: row.market.nameEn,
    marketNameAr: row.market.nameAr,
    marketSubdomain: row.market.subdomain,
  };
}
