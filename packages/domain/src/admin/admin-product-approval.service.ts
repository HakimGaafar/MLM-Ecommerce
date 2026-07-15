import type { PaginatedResult, ProductStatus } from "@mlm/shared";
import { buildPaginatedResult, normalizePagination } from "@mlm/shared";
import { Prisma, prisma } from "@mlm/db";

export type ProductApprovalRowDto = {
  id: string;
  reviewSubjectId: string;
  queueType: "NEW_PRODUCT" | "EDIT_REQUEST";
  name: string;
  price: string;
  currency: string;
  status: ProductStatus;
  fulfillmentType: string;
  vendorId: string;
  storeName: string;
  storeSlug: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedByName?: string | null;
  rejectionReason?: string | null;
};

function mapProductRow(
  r: {
    id: string;
    name: string;
    price: { toString(): string };
    currency: string;
    status: string;
    fulfillmentType: string;
    vendorId: string;
    createdAt: Date;
    updatedAt: Date;
    vendor: { storeName: string; slug: string };
  },
  extra?: {
    queueType?: "NEW_PRODUCT" | "EDIT_REQUEST";
    reviewSubjectId?: string;
    reviewedAt?: string;
    reviewedByName?: string | null;
    rejectionReason?: string | null;
  },
): ProductApprovalRowDto {
  return {
    id: r.id,
    reviewSubjectId: extra?.reviewSubjectId ?? r.id,
    queueType: extra?.queueType ?? "NEW_PRODUCT",
    name: r.name,
    price: r.price.toString(),
    currency: r.currency,
    status: r.status as ProductStatus,
    fulfillmentType: r.fulfillmentType,
    vendorId: r.vendorId,
    storeName: r.vendor.storeName,
    storeSlug: r.vendor.slug,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    ...extra,
  };
}

export async function listPendingNewProducts(params?: {
  page?: number;
  pageSize?: number;
  marketId?: string;
}): Promise<PaginatedResult<ProductApprovalRowDto>> {
  const { page, pageSize, skip, take } = normalizePagination(params);
  const where = {
    status: "PENDING" as const,
    ...(params?.marketId ? { marketId: params.marketId } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      skip,
      take,
      include: { vendor: { select: { storeName: true, slug: true } } },
    }),
    prisma.product.count({ where }),
  ]);
  return buildPaginatedResult(rows.map((r) => mapProductRow(r)), total, page, pageSize);
}

export const listPendingProducts = listPendingNewProducts;

export async function listPendingEditRequests(params?: {
  page?: number;
  pageSize?: number;
  marketId?: string;
}): Promise<PaginatedResult<ProductApprovalRowDto>> {
  const { page, pageSize, skip, take } = normalizePagination(params);
  const where = {
    status: "PENDING" as const,
    ...(params?.marketId ? { product: { marketId: params.marketId } } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.productEditRequest.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      skip,
      take,
      include: {
        product: { include: { vendor: { select: { storeName: true, slug: true } } } },
      },
    }),
    prisma.productEditRequest.count({ where }),
  ]);

  return buildPaginatedResult(
    rows.map((row) =>
      mapProductRow(
        {
          ...row.product,
          name: row.proposedName ?? row.product.name,
          price: row.proposedPrice ?? row.product.price,
          currency: row.proposedCurrency ?? row.product.currency,
          fulfillmentType: (row.proposedFulfillment ?? row.product.fulfillmentType) as string,
        },
        { queueType: "EDIT_REQUEST", reviewSubjectId: row.id },
      ),
    ),
    total,
    page,
    pageSize,
  );
}

export async function listProductApprovalHistory(
  action: "APPROVED" | "REJECTED",
  params?: { page?: number; pageSize?: number; marketId?: string },
): Promise<PaginatedResult<ProductApprovalRowDto>> {
  const { page, pageSize, skip, take } = normalizePagination(params);
  const where = {
    action,
    ...(params?.marketId ? { product: { marketId: params.marketId } } : {}),
  };
  const [reviews, total] = await prisma.$transaction([
    prisma.productReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        reviewedBy: { select: { name: true } },
        product: {
          include: { vendor: { select: { storeName: true, slug: true } } },
        },
      },
    }),
    prisma.productReview.count({ where }),
  ]);
  return buildPaginatedResult(
    reviews.map((review) => {
      const queueType = review.target === "EDIT_REQUEST" ? "EDIT_REQUEST" : "NEW_PRODUCT";
      return mapProductRow(review.product, {
        queueType,
        reviewSubjectId: review.editRequestId ?? review.productId,
        reviewedAt: review.createdAt.toISOString(),
        reviewedByName: review.reviewedBy?.name ?? null,
        rejectionReason: review.rejectionReason ?? null,
      });
    }),
    total,
    page,
    pageSize,
  );
}

export async function reviewPendingProduct(
  id: string,
  action: "approve" | "reject",
  rejectionReason?: string | null,
  reviewedByUserId?: string,
): Promise<ProductApprovalRowDto | null> {
  const existingProduct = await prisma.product.findFirst({
    where: { id, status: "PENDING" },
    include: { vendor: { select: { storeName: true, slug: true } } },
  });

  const nextStatus = action === "approve" ? "PUBLISHED" : "REJECTED";
  const reviewAction = action === "approve" ? "APPROVED" : "REJECTED";

  if (existingProduct) {
    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          status: nextStatus,
          isActive: nextStatus === "PUBLISHED",
        },
        include: { vendor: { select: { storeName: true, slug: true } } },
      });
      await tx.productReview.create({
        data: {
          productId: id,
          action: reviewAction,
          target: "NEW_PRODUCT",
          rejectionReason: action === "reject" ? (rejectionReason?.trim() ?? null) : null,
          reviewedByUserId: reviewedByUserId ?? null,
        },
      });
      return updated;
    });
    return mapProductRow(row);
  }

  const editRequest = await prisma.productEditRequest.findFirst({
    where: { id, status: "PENDING" },
    include: {
      product: { include: { vendor: { select: { storeName: true, slug: true } } } },
    },
  });
  if (!editRequest) return null;

  const row = await prisma.$transaction(async (tx) => {
    if (action === "approve") {
      const patch: Prisma.ProductUncheckedUpdateInput = {
        ...(editRequest.proposedName !== null ? { name: editRequest.proposedName } : {}),
        ...(editRequest.proposedPrice !== null ? { price: editRequest.proposedPrice } : {}),
        ...(editRequest.proposedCurrency !== null ? { currency: editRequest.proposedCurrency } : {}),
        ...(editRequest.proposedCategoryId !== null ? { categoryId: editRequest.proposedCategoryId } : {}),
        ...(editRequest.proposedFulfillment !== null ? { fulfillmentType: editRequest.proposedFulfillment } : {}),
        ...(editRequest.proposedMetaTitle !== null ? { metaTitle: editRequest.proposedMetaTitle } : {}),
        ...(editRequest.proposedMetaDesc !== null ? { metaDescription: editRequest.proposedMetaDesc } : {}),
      };
      await tx.product.update({
        where: { id: editRequest.productId },
        data: {
          ...patch,
          ...(editRequest.proposedImagesJson
            ? {}
            : {}),
        },
      });
      if (editRequest.proposedImagesJson) {
        const images = editRequest.proposedImagesJson as { url: string; sortOrder?: number; isPrimary?: boolean }[];
        await tx.productImage.deleteMany({ where: { productId: editRequest.productId } });
        if (images.length > 0) {
          const primaryIndex = Math.max(images.findIndex((img) => img.isPrimary), 0);
          await tx.productImage.createMany({
            data: images.map((img, index) => ({
              productId: editRequest.productId,
              url: img.url,
              sortOrder: img.sortOrder ?? index,
              isPrimary: index === primaryIndex,
            })),
          });
        }
      }
    }

    await tx.productEditRequest.update({
      where: { id: editRequest.id },
      data: {
        status: action === "approve" ? "APPROVED" : "REJECTED",
        rejectionReason: action === "reject" ? (rejectionReason?.trim() ?? null) : null,
        reviewedAt: new Date(),
        reviewedByUserId: reviewedByUserId ?? null,
      },
    });
    await tx.productReview.create({
      data: {
        productId: editRequest.productId,
        editRequestId: editRequest.id,
        action: reviewAction,
        target: "EDIT_REQUEST",
        rejectionReason: action === "reject" ? (rejectionReason?.trim() ?? null) : null,
        reviewedByUserId: reviewedByUserId ?? null,
      },
    });
    return tx.product.findFirstOrThrow({
      where: { id: editRequest.productId },
      include: { vendor: { select: { storeName: true, slug: true } } },
    });
  });

  return mapProductRow(row, { queueType: "EDIT_REQUEST", reviewSubjectId: editRequest.id });
}
