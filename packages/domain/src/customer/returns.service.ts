import type { OrderReturnReason, OrderReturnStatus, Prisma } from "@mlm/db";
import { prisma } from "@mlm/db";
import type { OrderReturnCreateInput } from "@mlm/shared";
import {
  linkUnitsToReturn,
  listReturnableUnitsForOrder,
  releaseUnitsFromReturn,
  type ReturnableUnitDto,
} from "../orders/order-units.service";
import { isOrderEligibleForReturn, RETURN_STATUSES_BLOCKING_NEW } from "./orders.service";

export type CustomerReturnUnitDto = {
  id: string;
  unitIndex: number | null;
  unitLabel: string | null;
  productName: string;
  lineTotal: string;
};

export type CustomerReturnListItemDto = {
  id: string;
  orderId: string;
  orderNo: string;
  status: OrderReturnStatus;
  reason: OrderReturnReason;
  createdAt: string;
  updatedAt: string;
  unitCount: number;
};

export type CustomerReturnDetailDto = CustomerReturnListItemDto & {
  details: string;
  rejectionReason: string | null;
  policyAcceptedAt: string;
  orderTotalAmount: string;
  units: CustomerReturnUnitDto[];
};

export class CustomerReturnError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "ORDER_NOT_ELIGIBLE"
      | "ACTIVE_RETURN_EXISTS"
      | "FORBIDDEN"
      | "INVALID_CANCEL"
      | "RETURN_UNITS_REQUIRED"
      | "RETURN_UNITS_INVALID"
      | "RETURN_UNITS_NOT_RETURNABLE",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "CustomerReturnError";
  }
}

export async function createOrderReturn(
  buyerUserId: string,
  input: OrderReturnCreateInput,
): Promise<CustomerReturnDetailDto> {
  const policyAcceptedAt = new Date();

  const created = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: input.orderId, buyerUserId },
    });
    if (!order) {
      throw new CustomerReturnError("FORBIDDEN", "Order not found for this account.");
    }
    if (!(await isOrderEligibleForReturn(order))) {
      throw new CustomerReturnError("ORDER_NOT_ELIGIBLE", "This order is not eligible for a return right now.");
    }

    const blocking = await tx.orderReturn.findFirst({
      where: { orderId: order.id, status: { in: RETURN_STATUSES_BLOCKING_NEW } },
      select: { id: true },
    });
    if (blocking) {
      throw new CustomerReturnError("ACTIVE_RETURN_EXISTS", "A return is already in progress for this order.");
    }

    const row = await tx.orderReturn.create({
      data: {
        orderId: order.id,
        buyerUserId,
        reason: input.reason,
        details: input.details,
        policyAcceptedAt,
        status: "REQUESTED",
      },
    });

    try {
      await linkUnitsToReturn({
        orderReturnId: row.id,
        orderId: order.id,
        unitIds: input.unitIds,
        tx,
      });
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === "RETURN_UNITS_REQUIRED") {
          throw new CustomerReturnError("RETURN_UNITS_REQUIRED", "Select at least one item to return.");
        }
        if (e.message === "RETURN_UNITS_INVALID") {
          throw new CustomerReturnError("RETURN_UNITS_INVALID", "One or more selected items are invalid.");
        }
        if (e.message === "RETURN_UNITS_NOT_RETURNABLE") {
          throw new CustomerReturnError(
            "RETURN_UNITS_NOT_RETURNABLE",
            "One or more selected items cannot be returned right now.",
          );
        }
      }
      throw e;
    }

    return row;
  });

  const detail = await getCustomerReturnDetail(buyerUserId, created.id);
  if (!detail) {
    throw new Error("RETURN_CREATE_INCONSISTENT");
  }
  return detail;
}

const RETURN_STATUS_FILTER_MAP: Record<string, OrderReturnStatus[]> = {
  active: [
    "REQUESTED",
    "RECEIPT_IN_PROGRESS",
    "RECEIPT_COMPLETED",
    "PROCESSING_IN_PROGRESS",
    "PROCESSING_COMPLETED",
    "REFUND_IN_PROGRESS",
  ],
  completed: ["REFUND_COMPLETED"],
  rejected: ["PROCESSING_REJECTED"],
  cancelled: ["CANCELLED_BY_CUSTOMER"],
};

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

export async function listCustomerReturns(params: {
  buyerUserId: string;
  marketId: string;
  statusFilter: string;
  dateRange: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  page: number;
  pageSize: number;
}): Promise<{
  items: CustomerReturnListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(50, Math.max(1, params.pageSize));
  const skip = (page - 1) * pageSize;

  const where: Prisma.OrderReturnWhereInput = {
    buyerUserId: params.buyerUserId,
    order: { marketId: params.marketId },
  };

  const normalizedStatus = params.statusFilter.trim().toLowerCase();
  if (normalizedStatus !== "all") {
    const mapped = RETURN_STATUS_FILTER_MAP[normalizedStatus];
    if (mapped) {
      where.status = { in: mapped };
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

  const [rows, total] = await prisma.$transaction([
    prisma.orderReturn.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        order: { select: { orderNo: true } },
        returnUnits: { select: { id: true } },
      },
    }),
    prisma.orderReturn.count({ where }),
  ]);

  const items: CustomerReturnListItemDto[] = rows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    orderNo: r.order.orderNo,
    status: r.status,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    unitCount: r.returnUnits.length,
  }));

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: skip + rows.length < total,
  };
}

export async function getCustomerReturnDetail(
  buyerUserId: string,
  returnId: string,
): Promise<CustomerReturnDetailDto | null> {
  const row = await prisma.orderReturn.findFirst({
    where: { id: returnId, buyerUserId },
    include: {
      order: { select: { orderNo: true, totalAmount: true } },
      returnUnits: {
        orderBy: [{ unitIndex: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          unitIndex: true,
          unitLabel: true,
          productNameSnapshot: true,
          lineTotal: true,
        },
      },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    orderId: row.orderId,
    orderNo: row.order.orderNo,
    status: row.status,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    unitCount: row.returnUnits.length,
    details: row.details,
    rejectionReason: row.rejectionReason,
    policyAcceptedAt: row.policyAcceptedAt.toISOString(),
    orderTotalAmount: row.order.totalAmount.toString(),
    units: row.returnUnits.map((u) => ({
      id: u.id,
      unitIndex: u.unitIndex,
      unitLabel: u.unitLabel,
      productName: u.productNameSnapshot,
      lineTotal: u.lineTotal.toString(),
    })),
  };
}

export async function listReturnableUnitsForCustomerOrder(
  buyerUserId: string,
  orderId: string,
): Promise<ReturnableUnitDto[]> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, buyerUserId },
    select: { id: true },
  });
  if (!order) return [];
  return listReturnableUnitsForOrder(orderId);
}

export { listReturnableUnitsForOrder } from "../orders/order-units.service";

const CANCEL_FORBIDDEN: OrderReturnStatus[] = ["REFUND_COMPLETED", "CANCELLED_BY_CUSTOMER", "PROCESSING_REJECTED"];

export async function cancelCustomerReturn(buyerUserId: string, returnId: string): Promise<{ status: OrderReturnStatus }> {
  const row = await prisma.orderReturn.findFirst({
    where: { id: returnId, buyerUserId },
    select: { id: true, status: true },
  });
  if (!row) {
    throw new CustomerReturnError("NOT_FOUND", "Return not found.");
  }
  if (CANCEL_FORBIDDEN.includes(row.status)) {
    throw new CustomerReturnError("INVALID_CANCEL", "This return can no longer be cancelled.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderReturn.update({
      where: { id: returnId },
      data: { status: "CANCELLED_BY_CUSTOMER" },
    });
    await releaseUnitsFromReturn(returnId, tx);
  });

  return { status: "CANCELLED_BY_CUSTOMER" };
}
