import type { OrderFulfillmentEscalationLevel, ProductFulfillmentType } from "@mlm/db";
import { prisma } from "@mlm/db";
import type { ProductFulfillmentTypeCode } from "@mlm/shared";
import { vendorMayUpdateFulfillmentType } from "@mlm/shared";

export class OrderEscalationError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_TARGET",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "OrderEscalationError";
  }
}

export type OrderEscalationDto = {
  id: string;
  orderId: string;
  vendorId: string;
  vendorName: string;
  fulfillmentType: ProductFulfillmentTypeCode | null;
  level: OrderFulfillmentEscalationLevel;
  message: string | null;
  createdByName: string;
  createdAt: string;
};

export type VendorEscalationBannerDto = {
  id: string;
  level: OrderFulfillmentEscalationLevel;
  fulfillmentType: ProductFulfillmentTypeCode | null;
  message: string | null;
  createdAt: string;
};

export async function listOrderEscalations(orderId: string): Promise<OrderEscalationDto[]> {
  const rows = await prisma.orderFulfillmentEscalation.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    include: {
      vendor: { select: { storeName: true } },
      createdBy: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    vendorId: r.vendorId,
    vendorName: r.vendor.storeName,
    fulfillmentType: r.fulfillmentType as ProductFulfillmentTypeCode | null,
    level: r.level,
    message: r.message,
    createdByName: r.createdBy.name,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function listVendorEscalationBanners(
  vendorId: string,
  orderId: string,
): Promise<VendorEscalationBannerDto[]> {
  const rows = await prisma.orderFulfillmentEscalation.findMany({
    where: { orderId, vendorId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return rows.map((r) => ({
    id: r.id,
    level: r.level,
    fulfillmentType: r.fulfillmentType as ProductFulfillmentTypeCode | null,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createOrderEscalation(input: {
  orderId: string;
  vendorId: string;
  fulfillmentType?: ProductFulfillmentTypeCode;
  level: OrderFulfillmentEscalationLevel;
  message?: string;
  createdByUserId: string;
}): Promise<OrderEscalationDto> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { id: true, status: true },
  });
  if (!order) throw new OrderEscalationError("NOT_FOUND", "Order not found.");
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    throw new OrderEscalationError("FORBIDDEN", "This order is finalized.");
  }

  const group = input.fulfillmentType
    ? await prisma.orderVendorShipping.findUnique({
        where: {
          orderId_vendorId_fulfillmentType: {
            orderId: input.orderId,
            vendorId: input.vendorId,
            fulfillmentType: input.fulfillmentType,
          },
        },
      })
    : null;

  if (input.fulfillmentType && !group) {
    throw new OrderEscalationError("INVALID_TARGET", "Fulfillment group not found.");
  }

  if (
    input.fulfillmentType &&
    !vendorMayUpdateFulfillmentType(input.fulfillmentType) &&
    input.level !== "REMINDER"
  ) {
    // Warehouse A: only REMINDER level to internal ops — still allow logging
  }

  const row = await prisma.orderFulfillmentEscalation.create({
    data: {
      orderId: input.orderId,
      vendorId: input.vendorId,
      fulfillmentType: input.fulfillmentType ?? null,
      level: input.level,
      message: input.message?.trim() || null,
      createdByUserId: input.createdByUserId,
    },
    include: {
      vendor: { select: { storeName: true } },
      createdBy: { select: { name: true } },
    },
  });

  return {
    id: row.id,
    orderId: row.orderId,
    vendorId: row.vendorId,
    vendorName: row.vendor.storeName,
    fulfillmentType: row.fulfillmentType as ProductFulfillmentTypeCode | null,
    level: row.level,
    message: row.message,
    createdByName: row.createdBy.name,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function countVendorEscalationsByLevel(
  vendorId: string,
  since: Date,
): Promise<{ warning: number; escalation: number }> {
  const rows = await prisma.orderFulfillmentEscalation.groupBy({
    by: ["level"],
    where: { vendorId, createdAt: { gte: since }, level: { in: ["WARNING", "ESCALATION"] } },
    _count: { _all: true },
  });
  let warning = 0;
  let escalation = 0;
  for (const r of rows) {
    if (r.level === "WARNING") warning = r._count._all;
    if (r.level === "ESCALATION") escalation = r._count._all;
  }
  return { warning, escalation };
}
