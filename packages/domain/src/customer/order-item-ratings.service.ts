import type { OrderItemRatingUpsertInput } from "@mlm/shared";
import { prisma, raceSafeUpsert } from "@mlm/db";

export type OrderItemRatingDto = {
  orderItemId: string;
  productStars: number;
  vendorStars: number;
  deliveryStars: number;
  comment?: string;
  updatedAt: string;
};

export class OrderItemRatingError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "NOT_ELIGIBLE" | "FORBIDDEN",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "OrderItemRatingError";
  }
}

export function isOrderEligibleForRatings(order: { status: string; paymentStatus: string }): boolean {
  return order.status === "COMPLETED" && order.paymentStatus === "PAID";
}

export async function upsertOrderItemRating(
  buyerUserId: string,
  input: OrderItemRatingUpsertInput,
): Promise<OrderItemRatingDto> {
  const line = await prisma.orderItem.findFirst({
    where: { id: input.orderItemId },
    include: {
      order: { select: { id: true, buyerUserId: true, status: true, paymentStatus: true } },
    },
  });

  if (!line) {
    throw new OrderItemRatingError("NOT_FOUND", "Order line not found.");
  }
  if (line.order.buyerUserId !== buyerUserId) {
    throw new OrderItemRatingError("FORBIDDEN", "This order does not belong to your account.");
  }
  if (!isOrderEligibleForRatings(line.order)) {
    throw new OrderItemRatingError("NOT_ELIGIBLE", "You can rate items only after the order is completed and paid.");
  }

  const row = await raceSafeUpsert({
    upsert: () =>
      prisma.orderItemRating.upsert({
        where: { orderItemId: input.orderItemId },
        create: {
          orderItemId: input.orderItemId,
          buyerUserId,
          productStars: input.productStars,
          vendorStars: input.vendorStars,
          deliveryStars: input.deliveryStars,
          comment: input.comment ?? null,
        },
        update: {
          productStars: input.productStars,
          vendorStars: input.vendorStars,
          deliveryStars: input.deliveryStars,
          comment: input.comment ?? null,
        },
      }),
    findUnique: () =>
      prisma.orderItemRating.findUnique({ where: { orderItemId: input.orderItemId } }),
  });

  return {
    orderItemId: row.orderItemId,
    productStars: row.productStars,
    vendorStars: row.vendorStars,
    deliveryStars: row.deliveryStars,
    comment: row.comment ?? undefined,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getOrderItemRatingsForOrder(orderId: string): Promise<Map<string, OrderItemRatingDto>> {
  const rows = await prisma.orderItemRating.findMany({
    where: { orderItem: { orderId } },
    select: {
      orderItemId: true,
      productStars: true,
      vendorStars: true,
      deliveryStars: true,
      comment: true,
      updatedAt: true,
    },
  });
  const map = new Map<string, OrderItemRatingDto>();
  for (const r of rows) {
    map.set(r.orderItemId, {
      orderItemId: r.orderItemId,
      productStars: r.productStars,
      vendorStars: r.vendorStars,
      deliveryStars: r.deliveryStars,
      comment: r.comment ?? undefined,
      updatedAt: r.updatedAt.toISOString(),
    });
  }
  return map;
}
