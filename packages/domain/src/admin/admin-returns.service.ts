import type { OrderReturnReason, OrderReturnStatus } from "@mlm/db";
import { prisma } from "@mlm/db";
import { releaseUnitsFromReturn } from "../orders/order-units.service";
import { onAdminReturnStatusChanged } from "../wallet/wallet.service";

export type AdminReturnListItemDto = {
  id: string;
  orderId: string;
  orderNo: string;
  buyerName: string;
  buyerEmail: string;
  status: OrderReturnStatus;
  reason: OrderReturnReason;
  createdAt: string;
};

export class AdminReturnError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "INVALID_TRANSITION", message?: string) {
    super(message ?? code);
    this.name = "AdminReturnError";
  }
}

const ADMIN_ALLOWED: Partial<Record<OrderReturnStatus, OrderReturnStatus[]>> = {
  REQUESTED: ["RECEIPT_IN_PROGRESS", "RECEIPT_COMPLETED"],
  RECEIPT_IN_PROGRESS: ["RECEIPT_COMPLETED"],
  RECEIPT_COMPLETED: ["PROCESSING_IN_PROGRESS"],
  PROCESSING_IN_PROGRESS: ["PROCESSING_COMPLETED", "PROCESSING_REJECTED"],
  PROCESSING_COMPLETED: ["REFUND_IN_PROGRESS"],
  REFUND_IN_PROGRESS: ["REFUND_COMPLETED"],
  PROCESSING_REJECTED: [],
  REFUND_COMPLETED: [],
  CANCELLED_BY_CUSTOMER: [],
};

export function allowedNextReturnStatuses(current: OrderReturnStatus): OrderReturnStatus[] {
  return ADMIN_ALLOWED[current] ?? [];
}

export async function listAdminReturns(params: {
  marketId: string;
  page: number;
  pageSize: number;
}): Promise<{
  items: AdminReturnListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(50, Math.max(1, params.pageSize));
  const skip = (page - 1) * pageSize;

  const [rows, total] = await prisma.$transaction([
    prisma.orderReturn.findMany({
      where: { order: { marketId: params.marketId } },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        order: { select: { orderNo: true } },
        buyer: { select: { name: true, email: true } },
      },
    }),
    prisma.orderReturn.count({ where: { order: { marketId: params.marketId } } }),
  ]);

  const items: AdminReturnListItemDto[] = rows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    orderNo: r.order.orderNo,
    buyerName: r.buyer.name,
    buyerEmail: r.buyer.email,
    status: r.status,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
  }));

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: skip + rows.length < total,
  };
}

export async function updateAdminReturnStatus(
  returnId: string,
  nextStatus: OrderReturnStatus,
  options?: { rejectionReason?: string },
): Promise<{ status: OrderReturnStatus }> {
  const row = await prisma.orderReturn.findUnique({
    where: { id: returnId },
    select: { id: true, status: true },
  });
  if (!row) {
    throw new AdminReturnError("NOT_FOUND", "Return not found.");
  }

  const allowed = ADMIN_ALLOWED[row.status];
  if (!allowed?.includes(nextStatus)) {
    throw new AdminReturnError("INVALID_TRANSITION", "That status change is not allowed from the current state.");
  }

  await prisma.orderReturn.update({
    where: { id: returnId },
    data: {
      status: nextStatus,
      ...(nextStatus === "PROCESSING_REJECTED"
        ? { rejectionReason: options?.rejectionReason?.trim() ?? null }
        : {}),
    },
  });

  if (nextStatus === "PROCESSING_REJECTED") {
    await releaseUnitsFromReturn(returnId);
  }

  await onAdminReturnStatusChanged(returnId, nextStatus);

  return { status: nextStatus };
}

export async function getAdminReturnDetail(returnId: string) {
  const row = await prisma.orderReturn.findUnique({
    where: { id: returnId },
    include: {
      order: { select: { id: true, orderNo: true, totalAmount: true, status: true } },
      buyer: { select: { name: true, email: true } },
      returnUnits: {
        orderBy: [{ unitIndex: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          unitIndex: true,
          unitLabel: true,
          productNameSnapshot: true,
          lineTotal: true,
          unitStatus: true,
        },
      },
    },
  });
  return row;
}
