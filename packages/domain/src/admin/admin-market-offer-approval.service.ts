import type { PaginatedResult } from "@mlm/shared";
import { buildPaginatedResult, normalizePagination } from "@mlm/shared";
import { prisma } from "@mlm/db";

export type MarketOfferApprovalRowDto = {
  offerId: string;
  productId: string;
  productName: string;
  productStatus: string;
  marketId: string;
  marketCode: string;
  price: string;
  currency: string;
  stockLocation: string;
  fourcesMode: string | null;
  quantity: number;
  status: string;
  vendorId: string;
  storeName: string;
  storeSlug: string;
  vendorShippingProfileStatus: string;
  homeMarketId: string;
  submittedAt: string | null;
  rejectionReason: string | null;
};

export class MarketOfferApprovalError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "INVALID_STATUS" | "PRODUCT_NOT_PUBLISHED",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "MarketOfferApprovalError";
  }
}

function mapRow(row: {
  id: string;
  productId: string;
  marketId: string;
  price: { toString(): string };
  currency: string;
  stockLocation: string;
  fourcesMode: string | null;
  quantity: number;
  status: string;
  submittedAt: Date | null;
  rejectionReason: string | null;
  market: { code: string };
  product: {
    name: string;
    status: string;
    marketId: string;
    vendorId: string;
    vendor: {
      storeName: string;
      slug: string;
      shippingProfileStatus: string;
    };
  };
}): MarketOfferApprovalRowDto {
  return {
    offerId: row.id,
    productId: row.productId,
    productName: row.product.name,
    productStatus: row.product.status,
    marketId: row.marketId,
    marketCode: row.market.code,
    price: row.price.toString(),
    currency: row.currency,
    stockLocation: row.stockLocation,
    fourcesMode: row.fourcesMode,
    quantity: row.quantity,
    status: row.status,
    vendorId: row.product.vendorId,
    storeName: row.product.vendor.storeName,
    storeSlug: row.product.vendor.slug,
    vendorShippingProfileStatus: row.product.vendor.shippingProfileStatus,
    homeMarketId: row.product.marketId,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
  };
}

const offerInclude = {
  market: { select: { code: true } },
  product: {
    select: {
      name: true,
      status: true,
      marketId: true,
      vendorId: true,
      vendor: {
        select: {
          storeName: true,
          slug: true,
          shippingProfileStatus: true,
        },
      },
    },
  },
} as const;

export async function listPendingMarketOffers(params?: {
  page?: number;
  pageSize?: number;
  marketId?: string;
}): Promise<PaginatedResult<MarketOfferApprovalRowDto>> {
  const { page, pageSize, skip, take } = normalizePagination(params);
  const where = {
    status: "PENDING" as const,
    product: { status: "PUBLISHED" as const },
    ...(params?.marketId ? { marketId: params.marketId } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.productMarketOffer.findMany({
      where,
      orderBy: [{ submittedAt: "asc" }, { updatedAt: "asc" }],
      skip,
      take,
      include: offerInclude,
    }),
    prisma.productMarketOffer.count({ where }),
  ]);
  return buildPaginatedResult(rows.map(mapRow), total, page, pageSize);
}

export async function reviewMarketOffer(
  offerId: string,
  action: "approve" | "reject",
  params: { reviewedByUserId: string; rejectionReason?: string | null },
): Promise<MarketOfferApprovalRowDto> {
  const existing = await prisma.productMarketOffer.findUnique({
    where: { id: offerId },
    include: offerInclude,
  });
  if (!existing) {
    throw new MarketOfferApprovalError("NOT_FOUND", "Market offer not found.");
  }
  if (existing.status !== "PENDING") {
    throw new MarketOfferApprovalError(
      "INVALID_STATUS",
      "Only pending market offers can be reviewed.",
    );
  }
  if (existing.product.status !== "PUBLISHED") {
    throw new MarketOfferApprovalError(
      "PRODUCT_NOT_PUBLISHED",
      "Approve the product first, then approve additional sell markets.",
    );
  }

  if (action === "reject") {
    const reason = params.rejectionReason?.trim();
    if (!reason) {
      throw new MarketOfferApprovalError("INVALID_STATUS", "Rejection reason is required.");
    }
    const updated = await prisma.productMarketOffer.update({
      where: { id: offerId },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
        reviewedAt: new Date(),
        reviewedByUserId: params.reviewedByUserId,
      },
      include: offerInclude,
    });
    return mapRow(updated);
  }

  const updated = await prisma.productMarketOffer.update({
    where: { id: offerId },
    data: {
      status: "APPROVED",
      rejectionReason: null,
      reviewedAt: new Date(),
      reviewedByUserId: params.reviewedByUserId,
    },
    include: offerInclude,
  });
  return mapRow(updated);
}
