import { prisma } from "@mlm/db";

export type ProductRatingSummaryDto = {
  average: number;
  count: number;
};

/** Aggregate public product stars from completed-order line ratings. */
export async function getProductRatingSummary(productId: string): Promise<ProductRatingSummaryDto> {
  const agg = await prisma.orderItemRating.aggregate({
    where: {
      orderItem: {
        productId,
        order: { status: "COMPLETED", paymentStatus: "PAID" },
      },
    },
    _avg: { productStars: true },
    _count: { _all: true },
  });
  const count = agg._count._all;
  const average = count > 0 ? Math.round((agg._avg.productStars ?? 0) * 10) / 10 : 0;
  return { average, count };
}
