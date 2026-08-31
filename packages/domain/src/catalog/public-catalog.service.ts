import type { PaginatedResult, PublicProductListQuery, PublicProductSort } from "@mlm/shared";
import { buildPaginatedResult, normalizePagination } from "@mlm/shared";
import { prisma, Prisma } from "@mlm/db";
import { resolveCategoryId } from "./product-categories.service";
import type { CatalogDeliveryContext } from "./catalog-delivery-context.service";

export type PublicProductListItemDto = {
  id: string;
  name: string;
  price: string;
  currency: string;
  vendorId: string;
  vendorName: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  imageUrl: string | null;
};

export type PublicProductDetailDto = PublicProductListItemDto & {
  updatedAt: string;
  metaTitle: string | null;
  metaDescription: string | null;
  images: { id: string; url: string; isPrimary: boolean }[];
};

type ProductRow = {
  id: string;
  name: string;
  price: Prisma.Decimal;
  currency: string;
  vendorId: string;
  categoryId: string;
  metaTitle: string | null;
  metaDescription: string | null;
  vendor: { storeName: string };
  category: { slug: string; nameEn: string; nameAr: string };
  images: { id: string; url: string; isPrimary: boolean }[];
  marketOffers: { price: Prisma.Decimal; currency: string }[];
};

function sortOrder(sort: PublicProductSort | undefined) {
  switch (sort) {
    case "price_asc":
      return [{ price: "asc" as const }];
    case "price_desc":
      return [{ price: "desc" as const }];
    case "name_asc":
      return [{ name: "asc" as const }];
    case "newest":
    default:
      return [{ updatedAt: "desc" as const }];
  }
}

function toListDto(row: ProductRow, locale: "en" | "ar"): PublicProductListItemDto {
  const primary = row.images.find((i) => i.isPrimary) ?? row.images[0];
  const offer = row.marketOffers?.[0];
  return {
    id: row.id,
    name: row.name,
    price: (offer?.price ?? row.price).toString(),
    currency: offer?.currency ?? row.currency,
    vendorId: row.vendorId,
    vendorName: row.vendor.storeName,
    categoryId: row.categoryId,
    categorySlug: row.category.slug,
    categoryName: locale === "ar" ? row.category.nameAr : row.category.nameEn,
    imageUrl: primary?.url ?? null,
  };
}

function productSelectForMarket(marketId?: string) {
  return {
    id: true,
    name: true,
    price: true,
    currency: true,
    vendorId: true,
    categoryId: true,
    metaTitle: true,
    metaDescription: true,
    vendor: { select: { storeName: true } },
    category: { select: { slug: true, nameEn: true, nameAr: true } },
    images: {
      orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
      select: { id: true, url: true, isPrimary: true },
    },
    marketOffers: {
      where: marketId ? { marketId } : undefined,
      take: 1,
      select: { price: true, currency: true },
    },
  };
}

export function publishedInMarketWhere(marketId: string, _delivery?: CatalogDeliveryContext | null) {
  return {
    status: "PUBLISHED" as const,
    AND: [
      { vendor: { storeApprovalStatus: "APPROVED" as const } },
      {
        OR: [
          {
            marketOffers: {
              some: { marketId, stockLocation: "FOURCES_WAREHOUSE" as const },
            },
          },
          {
            marketOffers: {
              some: { marketId, stockLocation: "MERCHANT" as const },
            },
          },
          { marketId, marketOffers: { none: {} } },
        ],
      },
    ],
  };
}

/** Preserve order of `orderedIds`; skips missing or unpublished IDs. */
export async function findPublishedProductsByIds(
  orderedIds: string[],
  locale: "en" | "ar" = "en",
  marketId?: string,
  delivery?: CatalogDeliveryContext | null,
): Promise<PublicProductListItemDto[]> {
  if (orderedIds.length === 0) return [];
  const rows = await prisma.product.findMany({
    where: {
      id: { in: [...new Set(orderedIds)] },
      ...(marketId
        ? publishedInMarketWhere(marketId, delivery)
        : { status: "PUBLISHED", vendor: { storeApprovalStatus: "APPROVED" } }),
    },
    select: productSelectForMarket(marketId),
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return orderedIds
    .map((id) => byId.get(id))
    .filter((r): r is ProductRow => r != null)
    .map((r) => toListDto(r, locale));
}

export async function searchPublicProducts(
  params: PublicProductListQuery & {
    locale?: "en" | "ar";
    marketId: string;
    delivery?: CatalogDeliveryContext | null;
  },
): Promise<PaginatedResult<PublicProductListItemDto>> {
  const locale = params.locale ?? "en";
  const { page, pageSize, skip, take } = normalizePagination({
    page: params.page,
    pageSize: params.pageSize ?? params.limit,
  });
  const categoryId = await resolveCategoryId({
    marketId: params.marketId,
    categoryId: params.categoryId,
    categorySlug: params.categorySlug,
  });

  if (params.categoryId && !categoryId) {
    return buildPaginatedResult([], 0, page, pageSize);
  }
  if (params.categorySlug && !categoryId) {
    return buildPaginatedResult([], 0, page, pageSize);
  }

  const where = {
    ...publishedInMarketWhere(params.marketId, params.delivery),
    ...(categoryId ? { categoryId } : {}),
    ...(params.vendorId ? { vendorId: params.vendorId } : {}),
    ...(params.q ? { name: { contains: params.q, mode: "insensitive" as const } } : {}),
    ...(params.minPrice !== undefined || params.maxPrice !== undefined
      ? {
          OR: [
            {
              marketOffers: {
                some: {
                  marketId: params.marketId,
                  price: {
                    ...(params.minPrice !== undefined ? { gte: params.minPrice } : {}),
                    ...(params.maxPrice !== undefined ? { lte: params.maxPrice } : {}),
                  },
                },
              },
            },
            {
              marketOffers: { none: {} },
              price: {
                ...(params.minPrice !== undefined ? { gte: params.minPrice } : {}),
                ...(params.maxPrice !== undefined ? { lte: params.maxPrice } : {}),
              },
            },
          ],
        }
      : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: sortOrder(params.sort),
      skip,
      take,
      select: productSelectForMarket(params.marketId),
    }),
    prisma.product.count({ where }),
  ]);

  return buildPaginatedResult(
    rows.map((row) => toListDto(row, locale)),
    total,
    page,
    pageSize,
  );
}

/** @deprecated Use searchPublicProducts — kept for home page quick fetch */
export async function listPublicProducts(params: {
  limit: number;
  locale?: "en" | "ar";
  marketId: string;
  delivery?: CatalogDeliveryContext | null;
}): Promise<PublicProductListItemDto[]> {
  const result = await searchPublicProducts({
    pageSize: params.limit,
    page: 1,
    locale: params.locale,
    marketId: params.marketId,
    delivery: params.delivery,
  });
  return result.items ?? [];
}

export async function getPublicProductById(
  productId: string,
  locale: "en" | "ar" = "en",
  marketId?: string,
  delivery?: CatalogDeliveryContext | null,
): Promise<PublicProductDetailDto | null> {
  const row = await prisma.product.findFirst({
    where: {
      id: productId,
      ...(marketId
        ? publishedInMarketWhere(marketId, delivery)
        : { status: "PUBLISHED", vendor: { storeApprovalStatus: "APPROVED" } }),
    },
    select: {
      ...productSelectForMarket(marketId),
      updatedAt: true,
    },
  });
  if (!row) return null;
  return {
    ...toListDto(row, locale),
    updatedAt: row.updatedAt.toISOString(),
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    images: row.images,
  };
}
