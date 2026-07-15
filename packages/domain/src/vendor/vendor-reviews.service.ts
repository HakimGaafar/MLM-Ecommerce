import type { VendorReviewListTab } from "@mlm/shared";
import type { Prisma } from "@mlm/db";
import { prisma } from "@mlm/db";

export type VendorReviewListItemDto = {
  id: string;
  orderItemId: string;
  orderId: string;
  orderNo: string;
  productId: string | null;
  productName: string;
  buyerName: string;
  productStars: number;
  vendorStars: number;
  deliveryStars: number;
  comment: string | null;
  ratedAt: string;
};

export type VendorReviewListResult = {
  items: VendorReviewListItemDto[];
  page: number;
  pageSize: number;
  total: number;
  filters: { tab: VendorReviewListTab; q?: string; productId?: string; orderItemId?: string };
};

function tabWhere(tab: VendorReviewListTab): Prisma.OrderItemRatingWhereInput {
  switch (tab) {
    case "low":
      return {
        OR: [{ productStars: { lte: 2 } }, { vendorStars: { lte: 2 } }],
      };
    case "commented":
      return { comment: { not: null } };
    default:
      return {};
  }
}

export async function listVendorOrderItemRatings(params: {
  vendorId: string;
  tab: VendorReviewListTab;
  q?: string;
  productId?: string;
  orderItemId?: string;
  page: number;
  pageSize: number;
}): Promise<VendorReviewListResult> {
  const search = params.q?.trim();
  const where: Prisma.OrderItemRatingWhereInput = {
    ...tabWhere(params.tab),
    orderItem: {
      vendorId: params.vendorId,
      ...(params.productId ? { productId: params.productId } : {}),
      ...(params.orderItemId ? { id: params.orderItemId } : {}),
      ...(search
        ? {
            OR: [
              { productNameSnapshot: { contains: search, mode: "insensitive" } },
              { order: { orderNo: { contains: search, mode: "insensitive" } } },
              { order: { buyer: { name: { contains: search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
  };

  const [total, rows] = await Promise.all([
    prisma.orderItemRating.count({ where }),
    prisma.orderItemRating.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      select: {
        id: true,
        productStars: true,
        vendorStars: true,
        deliveryStars: true,
        comment: true,
        updatedAt: true,
        orderItem: {
          select: {
            id: true,
            productId: true,
            productNameSnapshot: true,
            order: {
              select: {
                id: true,
                orderNo: true,
                buyer: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      orderItemId: r.orderItem.id,
      orderId: r.orderItem.order.id,
      orderNo: r.orderItem.order.orderNo,
      productId: r.orderItem.productId,
      productName: r.orderItem.productNameSnapshot,
      buyerName: r.orderItem.order.buyer.name,
      productStars: r.productStars,
      vendorStars: r.vendorStars,
      deliveryStars: r.deliveryStars,
      comment: r.comment,
      ratedAt: r.updatedAt.toISOString(),
    })),
    page: params.page,
    pageSize: params.pageSize,
    total,
    filters: {
      tab: params.tab,
      q: params.q,
      productId: params.productId,
      orderItemId: params.orderItemId,
    },
  };
}
