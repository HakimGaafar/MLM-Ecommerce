import type {
  PaginatedResult,
  ProductFulfillmentTypeCode,
  ProductStatus,
  VendorProductCreateInput,
  VendorProductUpdateInput,
} from "@mlm/shared";
import {
  buildPaginatedResult,
  defaultFulfillmentFromVendorProfile,
  normalizePagination,
  seoFieldsToNullables,
} from "@mlm/shared";
import { prisma } from "@mlm/db";
import { assertActiveCategoryId } from "../catalog/product-categories.service";
import { assertVendorShippingApproved } from "./vendor-shipping.service";

export class VendorProductError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "INVALID_STATUS"
      | "HAS_ORDER_HISTORY"
      | "INVALID_CATEGORY"
      | "PENDING_EDIT_REQUEST_EXISTS",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "VendorProductError";
  }
}

export type VendorProductImageDto = {
  id: string;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
};

export type VendorProductDto = {
  id: string;
  name: string;
  price: string;
  currency: string;
  status: ProductStatus;
  isActive: boolean;
  categoryId: string;
  categoryName: string;
  fulfillmentType: ProductFulfillmentTypeCode;
  metaTitle: string | null;
  metaDescription: string | null;
  images: VendorProductImageDto[];
  createdAt: string;
  updatedAt: string;
  pendingEditRequestId: string | null;
  pendingEditRequestedAt: string | null;
  latestEditRejectionReason: string | null;
  latestProductRejectionReason: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  price: { toString(): string };
  currency: string;
  status: string;
  isActive: boolean;
  categoryId: string;
  fulfillmentType: string;
  metaTitle: string | null;
  metaDescription: string | null;
  category: { nameEn: string; nameAr: string };
  images: { id: string; url: string; sortOrder: number; isPrimary: boolean }[];
  editRequests: { id: string; status: string; rejectionReason: string | null; createdAt: Date }[];
  reviews: { rejectionReason: string | null }[];
  createdAt: Date;
  updatedAt: Date;
};

function toDto(row: ProductRow, locale: "en" | "ar" = "en"): VendorProductDto {
  return {
    id: row.id,
    name: row.name,
    price: row.price.toString(),
    currency: row.currency,
    status: row.status as ProductStatus,
    isActive: row.isActive,
    categoryId: row.categoryId,
    categoryName: locale === "ar" ? row.category.nameAr : row.category.nameEn,
    fulfillmentType: row.fulfillmentType as ProductFulfillmentTypeCode,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    images: row.images.map((img) => ({
      id: img.id,
      url: img.url,
      sortOrder: img.sortOrder,
      isPrimary: img.isPrimary,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    pendingEditRequestId: row.editRequests.find((r) => r.status === "PENDING")?.id ?? null,
    pendingEditRequestedAt:
      row.editRequests.find((r) => r.status === "PENDING")?.createdAt.toISOString() ?? null,
    latestEditRejectionReason:
      row.editRequests.find((r) => r.status === "REJECTED")?.rejectionReason ?? null,
    latestProductRejectionReason: row.reviews[0]?.rejectionReason ?? null,
  };
}

const productInclude = {
  category: { select: { nameEn: true, nameAr: true } },
  images: { orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }] },
  editRequests: {
    orderBy: { createdAt: "desc" as const },
    take: 5,
    select: { id: true, status: true, rejectionReason: true, createdAt: true },
  },
  reviews: {
    where: { action: "REJECTED" as const, target: "NEW_PRODUCT" as const },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { rejectionReason: true },
  },
};

/** First image flagged `isPrimary: true` wins; otherwise index 0. */
function resolvePrimaryImageIndex(images: { isPrimary?: boolean }[]): number {
  const i = images.findIndex((img) => img.isPrimary === true);
  return i >= 0 ? i : 0;
}

function assertVendorStatusChange(current: ProductStatus, next: ProductStatus): void {
  if (current === next) return;
  if (next === "PUBLISHED" || next === "PENDING" || next === "REJECTED") {
    throw new Error("INVALID_STATUS_TRANSITION");
  }
  const allowed: Partial<Record<ProductStatus, ProductStatus[]>> = {
    PUBLISHED: ["ON_HOLD"],
    ON_HOLD: ["DRAFT"],
  };
  if (!(allowed[current]?.includes(next) ?? false)) {
    throw new Error("INVALID_STATUS_TRANSITION");
  }
}

export async function listVendorProducts(
  vendorId: string,
  params?: { status?: ProductStatus; page?: number; pageSize?: number },
  locale: "en" | "ar" = "en",
): Promise<PaginatedResult<VendorProductDto>> {
  const { page, pageSize, skip, take } = normalizePagination(params);
  const where = {
    vendorId,
    ...(params?.status ? { status: params.status } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
      include: productInclude,
    }),
    prisma.product.count({ where }),
  ]);
  return buildPaginatedResult(
    rows.map((row) => toDto(row, locale)),
    total,
    page,
    pageSize,
  );
}

export async function getVendorProduct(
  vendorId: string,
  productId: string,
  locale: "en" | "ar" = "en",
): Promise<VendorProductDto | null> {
  const row = await prisma.product.findFirst({
    where: { id: productId, vendorId },
    include: productInclude,
  });
  return row ? toDto(row, locale) : null;
}

export async function createVendorProduct(
  vendorId: string,
  input: VendorProductCreateInput,
  locale: "en" | "ar" = "en",
): Promise<VendorProductDto> {
  const vendorRow = await prisma.vendor.findUniqueOrThrow({
    where: { id: vendorId },
    select: { marketId: true },
  });

  try {
    await assertActiveCategoryId(input.categoryId, vendorRow.marketId);
  } catch {
    throw new VendorProductError("INVALID_CATEGORY", "Invalid product category.");
  }

  const row = await prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.findUniqueOrThrow({
      where: { id: vendorId },
      select: { shippingMode: true, indirectFulfillment: true, marketId: true, market: { select: { defaultCurrency: true } } },
    });
    const fulfillmentType =
      input.fulfillmentType ??
      defaultFulfillmentFromVendorProfile(vendor.shippingMode, vendor.indirectFulfillment ?? undefined);

    const product = await tx.product.create({
      data: {
        marketId: vendor.marketId,
        vendorId,
        categoryId: input.categoryId,
        name: input.name,
        price: input.price,
        currency: input.currency ?? vendor.market.defaultCurrency,
        fulfillmentType,
        status: "DRAFT",
        isActive: false,
        ...seoFieldsToNullables({
          metaTitle: input.metaTitle,
          metaDescription: input.metaDescription,
        }),
      },
      include: productInclude,
    });
    const primaryIndex = resolvePrimaryImageIndex(input.images);
    await tx.productImage.createMany({
      data: input.images.map((img, index) => ({
        productId: product.id,
        url: img.url,
        sortOrder: img.sortOrder ?? index,
        isPrimary: index === primaryIndex,
      })),
    });
    return tx.product.findFirstOrThrow({
      where: { id: product.id },
      include: productInclude,
    });
  });

  return toDto(row, locale);
}

export async function updateVendorProduct(
  vendorId: string,
  productId: string,
  input: VendorProductUpdateInput,
  locale: "en" | "ar" = "en",
): Promise<VendorProductDto | null> {
  const existing = await prisma.product.findFirst({
    where: { id: productId, vendorId },
  });
  if (!existing) return null;

  if (input.categoryId) {
    try {
      await assertActiveCategoryId(input.categoryId, existing.marketId);
    } catch {
      throw new VendorProductError("INVALID_CATEGORY", "Invalid product category.");
    }
  }

  if (input.status !== undefined) {
    assertVendorStatusChange(existing.status as ProductStatus, input.status);
  }

  const row = await prisma.$transaction(async (tx) => {
    const existingPending = await tx.productEditRequest.findFirst({
      where: { productId, status: "PENDING" },
      select: { id: true },
    });
    if (existingPending) {
      throw new VendorProductError(
        "PENDING_EDIT_REQUEST_EXISTS",
        "A pending edit request already exists for this product.",
      );
    }

    if (existing.status === "PUBLISHED" || existing.status === "ON_HOLD") {
      const hasChangeFields =
        input.name !== undefined ||
        input.price !== undefined ||
        input.currency !== undefined ||
        input.categoryId !== undefined ||
        input.fulfillmentType !== undefined ||
        input.metaTitle !== undefined ||
        input.metaDescription !== undefined ||
        input.images !== undefined;
      if (hasChangeFields) {
        await tx.productEditRequest.create({
          data: {
            productId,
            vendorId,
            proposedName: input.name ?? null,
            proposedPrice: input.price ?? null,
            proposedCurrency: input.currency ?? null,
            proposedCategoryId: input.categoryId ?? null,
            proposedFulfillment: input.fulfillmentType ?? null,
            proposedMetaTitle: input.metaTitle ?? null,
            proposedMetaDesc: input.metaDescription ?? null,
            ...(input.images !== undefined ? { proposedImagesJson: input.images } : {}),
          },
        });
      }
      return tx.product.findFirstOrThrow({
        where: { id: productId },
        include: productInclude,
      });
    }

    await tx.product.update({
      where: { id: productId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.fulfillmentType !== undefined ? { fulfillmentType: input.fulfillmentType } : {}),
        ...(input.status !== undefined
          ? { status: input.status, isActive: input.status === "PUBLISHED" }
          : {}),
        ...seoFieldsToNullables({
          metaTitle: input.metaTitle,
          metaDescription: input.metaDescription,
        }),
      },
    });
    if (input.images !== undefined) {
      await tx.productImage.deleteMany({ where: { productId } });
      if (input.images.length > 0) {
        const primaryIndex = resolvePrimaryImageIndex(input.images);
        await tx.productImage.createMany({
          data: input.images.map((img, index) => ({
            productId,
            url: img.url,
            sortOrder: img.sortOrder ?? index,
            isPrimary: index === primaryIndex,
          })),
        });
      }
    }
    return tx.product.findFirstOrThrow({
      where: { id: productId },
      include: productInclude,
    });
  });

  return toDto(row, locale);
}

export async function submitVendorProductForReview(
  vendorId: string,
  productId: string,
  locale: "en" | "ar" = "en",
): Promise<VendorProductDto | null> {
  const existing = await prisma.product.findFirst({
    where: { id: productId, vendorId },
  });
  if (!existing) return null;

  await assertVendorShippingApproved(vendorId);

  const current = existing.status as ProductStatus;
  if (current !== "DRAFT" && current !== "ON_HOLD" && current !== "REJECTED") {
    throw new Error("INVALID_STATUS_TRANSITION");
  }

  const row = await prisma.product.update({
    where: { id: productId },
    data: { status: "PENDING", isActive: false },
    include: productInclude,
  });
  return toDto(row, locale);
}

export const publishedProductFilter = { status: "PUBLISHED" as const };

export async function deleteVendorProduct(vendorId: string, productId: string): Promise<void> {
  const existing = await prisma.product.findFirst({
    where: { id: productId, vendorId },
    select: { id: true, status: true },
  });
  if (!existing) {
    throw new VendorProductError("NOT_FOUND", "Product not found.");
  }

  const orderLineCount = await prisma.orderItem.count({
    where: { productId },
  });
  if (orderLineCount > 0) {
    throw new VendorProductError(
      "HAS_ORDER_HISTORY",
      "This product was used in orders and cannot be deleted.",
    );
  }

  await prisma.product.delete({ where: { id: productId } });
}
