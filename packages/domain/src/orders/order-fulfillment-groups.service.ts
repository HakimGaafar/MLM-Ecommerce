import type { OrderStatus, ProductFulfillmentType } from "@mlm/db";
import { prisma, type Prisma } from "@mlm/db";
import type { ProductFulfillmentTypeCode } from "@mlm/shared";
import {
  adminMayUpdateFulfillmentType,
  vendorMayUpdateFulfillmentType,
} from "@mlm/shared";

export class OrderFulfillmentGroupError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "INVALID_TRANSITION"
      | "ORDER_FINALIZED",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "OrderFulfillmentGroupError";
  }
}

export type FulfillmentGroupDto = {
  vendorId: string;
  vendorName: string;
  fulfillmentType: ProductFulfillmentTypeCode;
  fulfillmentStatus: OrderStatus;
  fulfillmentUpdatedAt: string;
  lineCount: number;
  canVendorUpdate: boolean;
  canAdminUpdate: boolean;
};

const GROUP_ALLOWED: Partial<Record<OrderStatus, OrderStatus[]>> = {
  NEW: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: [],
  COMPLETED: [],
  CANCELLED: [],
};

function assertTransition(current: OrderStatus, next: OrderStatus): void {
  const allowed = GROUP_ALLOWED[current];
  if (!allowed?.includes(next)) {
    throw new OrderFulfillmentGroupError(
      "INVALID_TRANSITION",
      "That fulfillment status change is not allowed from the current state.",
    );
  }
}

async function syncItemsForGroup(
  tx: Prisma.TransactionClient,
  orderId: string,
  vendorId: string,
  fulfillmentType: ProductFulfillmentType,
  status: OrderStatus,
  updatedAt: Date,
): Promise<void> {
  await tx.orderItem.updateMany({
    where: { orderId, vendorId, fulfillmentType },
    data: {
      vendorFulfillmentStatus: status,
      vendorFulfillmentUpdatedAt: updatedAt,
    },
  });
}

export async function rollupOrderStatus(orderId: string, tx: Prisma.TransactionClient): Promise<void> {
  const [order, groups] = await Promise.all([
    tx.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    }),
    tx.orderVendorShipping.findMany({
      where: { orderId },
      select: { fulfillmentStatus: true },
    }),
  ]);
  if (!order || groups.length === 0) return;
  if (order.status === "CANCELLED") return;

  const statuses = groups.map((g) => g.fulfillmentStatus);
  if (statuses.every((s) => s === "CANCELLED")) {
    await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
    return;
  }

  const active = statuses.filter((s) => s !== "CANCELLED");
  if (active.every((s) => s === "SHIPPED" || s === "COMPLETED")) {
    if (order.status !== "SHIPPED" && order.status !== "COMPLETED") {
      await tx.order.update({ where: { id: orderId }, data: { status: "SHIPPED" } });
    }
    return;
  }
  if (active.some((s) => s === "PROCESSING" || s === "SHIPPED" || s === "COMPLETED")) {
    if (order.status === "NEW") {
      await tx.order.update({ where: { id: orderId }, data: { status: "PROCESSING" } });
    }
  }
}

export async function listVendorFulfillmentGroups(
  vendorId: string,
  orderId: string,
): Promise<FulfillmentGroupDto[]> {
  const groups = await prisma.orderVendorShipping.findMany({
    where: { orderId, vendorId },
    orderBy: { fulfillmentType: "asc" },
  });
  if (groups.length === 0) return [];

  const lineCounts = await prisma.orderItem.groupBy({
    by: ["fulfillmentType"],
    where: { orderId, vendorId },
    _count: { _all: true },
  });
  const countByType = new Map(lineCounts.map((row) => [row.fulfillmentType, row._count._all]));

  return groups.map((g) => ({
    vendorId: g.vendorId,
    vendorName: g.vendorNameSnapshot,
    fulfillmentType: g.fulfillmentType as ProductFulfillmentTypeCode,
    fulfillmentStatus: g.fulfillmentStatus,
    fulfillmentUpdatedAt: g.fulfillmentUpdatedAt.toISOString(),
    lineCount: countByType.get(g.fulfillmentType) ?? 0,
    canVendorUpdate: vendorMayUpdateFulfillmentType(g.fulfillmentType as ProductFulfillmentTypeCode),
    canAdminUpdate: adminMayUpdateFulfillmentType(g.fulfillmentType as ProductFulfillmentTypeCode),
  }));
}

export async function listAdminWarehouseFulfillmentGroups(orderId: string): Promise<FulfillmentGroupDto[]> {
  const groups = await prisma.orderVendorShipping.findMany({
    where: { orderId, fulfillmentType: "FORSEIZ_STOCK" },
    orderBy: [{ vendorNameSnapshot: "asc" }],
  });
  if (groups.length === 0) return [];

  const lineCounts = await prisma.orderItem.groupBy({
    by: ["vendorId", "fulfillmentType"],
    where: { orderId, fulfillmentType: "FORSEIZ_STOCK" },
    _count: { _all: true },
  });
  const countKey = (v: string, t: ProductFulfillmentType) => `${v}:${t}`;
  const countByKey = new Map(
    lineCounts.map((row) => [countKey(row.vendorId, row.fulfillmentType), row._count._all]),
  );

  return groups.map((g) => ({
    vendorId: g.vendorId,
    vendorName: g.vendorNameSnapshot,
    fulfillmentType: g.fulfillmentType as ProductFulfillmentTypeCode,
    fulfillmentStatus: g.fulfillmentStatus,
    fulfillmentUpdatedAt: g.fulfillmentUpdatedAt.toISOString(),
    lineCount: countByKey.get(countKey(g.vendorId, g.fulfillmentType)) ?? 0,
    canVendorUpdate: false,
    canAdminUpdate: true,
  }));
}

export async function countPendingFulfillmentGroups(orderId: string): Promise<number> {
  return prisma.orderVendorShipping.count({
    where: { orderId, fulfillmentStatus: { in: ["NEW", "PROCESSING"] } },
  });
}

/** Mark every non-cancelled fulfillment group and line item completed (admin order completion). */
export async function completeAllFulfillmentGroups(
  orderId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const updatedAt = new Date();
  await tx.orderVendorShipping.updateMany({
    where: { orderId, fulfillmentStatus: { not: "CANCELLED" } },
    data: { fulfillmentStatus: "COMPLETED", fulfillmentUpdatedAt: updatedAt },
  });
  await tx.orderItem.updateMany({
    where: { orderId, vendorFulfillmentStatus: { not: "CANCELLED" } },
    data: { vendorFulfillmentStatus: "COMPLETED", vendorFulfillmentUpdatedAt: updatedAt },
  });
}

export async function updateVendorFulfillmentGroup(
  vendorId: string,
  orderId: string,
  fulfillmentType: ProductFulfillmentTypeCode,
  nextStatus: OrderStatus,
): Promise<{ fulfillmentType: ProductFulfillmentTypeCode; fulfillmentStatus: OrderStatus }> {
  if (!vendorMayUpdateFulfillmentType(fulfillmentType)) {
    throw new OrderFulfillmentGroupError(
      "FORBIDDEN",
      "Warehouse A items are fulfilled by the platform warehouse.",
    );
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, items: { some: { vendorId } } },
    select: { id: true, status: true },
  });
  if (!order) {
    throw new OrderFulfillmentGroupError("NOT_FOUND", "Order not found.");
  }
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    throw new OrderFulfillmentGroupError("ORDER_FINALIZED", "This order is already finalized.");
  }

  const group = await prisma.orderVendorShipping.findUnique({
    where: {
      orderId_vendorId_fulfillmentType: {
        orderId,
        vendorId,
        fulfillmentType,
      },
    },
  });
  if (!group) {
    throw new OrderFulfillmentGroupError("NOT_FOUND", "Fulfillment group not found.");
  }

  assertTransition(group.fulfillmentStatus, nextStatus);
  const updatedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.orderVendorShipping.update({
      where: { id: group.id },
      data: { fulfillmentStatus: nextStatus, fulfillmentUpdatedAt: updatedAt },
    });
    await syncItemsForGroup(tx, orderId, vendorId, fulfillmentType, nextStatus, updatedAt);
    await rollupOrderStatus(orderId, tx);
  });

  return { fulfillmentType, fulfillmentStatus: nextStatus };
}

export async function updateAdminFulfillmentGroup(
  orderId: string,
  vendorId: string,
  fulfillmentType: ProductFulfillmentTypeCode,
  nextStatus: OrderStatus,
): Promise<{ fulfillmentType: ProductFulfillmentTypeCode; fulfillmentStatus: OrderStatus }> {
  if (!adminMayUpdateFulfillmentType(fulfillmentType)) {
    throw new OrderFulfillmentGroupError(
      "FORBIDDEN",
      "Only Warehouse A fulfillment groups can be updated by admin.",
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  });
  if (!order) {
    throw new OrderFulfillmentGroupError("NOT_FOUND", "Order not found.");
  }
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    throw new OrderFulfillmentGroupError("ORDER_FINALIZED", "This order is already finalized.");
  }

  const group = await prisma.orderVendorShipping.findUnique({
    where: {
      orderId_vendorId_fulfillmentType: {
        orderId,
        vendorId,
        fulfillmentType,
      },
    },
  });
  if (!group) {
    throw new OrderFulfillmentGroupError("NOT_FOUND", "Fulfillment group not found.");
  }

  assertTransition(group.fulfillmentStatus, nextStatus);
  const updatedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.orderVendorShipping.update({
      where: { id: group.id },
      data: { fulfillmentStatus: nextStatus, fulfillmentUpdatedAt: updatedAt },
    });
    await syncItemsForGroup(tx, orderId, vendorId, fulfillmentType, nextStatus, updatedAt);
    await rollupOrderStatus(orderId, tx);
  });

  return { fulfillmentType, fulfillmentStatus: nextStatus };
}
