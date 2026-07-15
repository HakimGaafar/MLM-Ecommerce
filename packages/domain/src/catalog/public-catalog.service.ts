import type { PaginatedResult, PublicProductListQuery, PublicProductSort } from "@mlm/shared";
import { buildPaginatedResult, normalizePagination } from "@mlm/shared";
import { prisma, Prisma } from "@mlm/db";
import { resolveCategoryId } from "./product-categories.service";

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
  return {
    id: row.id,
    name: row.name,
    price: row.price.toString(),
    currency: row.currency,
    vendorId: row.vendorId,
    vendorName: row.vendor.storeName,
    categoryId: row.categoryId,
    categorySlug: row.category.slug,
    categoryName: locale === "ar" ? row.category.nameAr : row.category.nameEn,
    imageUrl: primary?.url ?? null,
  };
}

const productSelect = {
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
};

/** Preserve order of `orderedIds`; skips missing or unpublished IDs. */
export async function findPublishedProductsByIds(
  orderedIds: string[],
  locale: "en" | "ar" = "en",
  marketId?: string,
): Promise<PublicProductListItemDto[]> {
  if (orderedIds.length === 0) return [];
  const rows = await prisma.product.findMany({
    where: {
      id: { in: [...new Set(orderedIds)] },
      status: "PUBLISHED",
      ...(marketId ? { marketId } : {}),
    },
    select: productSelect,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return orderedIds
    .map((id) => byId.get(id))
    .filter((r): r is ProductRow => r != null)
    .map((r) => toListDto(r, locale));
}

export async function searchPublicProducts(
  params: PublicProductListQuery & { locale?: "en" | "ar"; marketId: string },
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
    marketId: params.marketId,
    status: "PUBLISHED" as const,
    ...(categoryId ? { categoryId } : {}),
    ...(params.vendorId ? { vendorId: params.vendorId } : {}),
    ...(params.q ? { name: { contains: params.q, mode: "insensitive" as const } } : {}),
    ...(params.minPrice !== undefined || params.maxPrice !== undefined
      ? {
          price: {
            ...(params.minPrice !== undefined ? { gte: params.minPrice } : {}),
            ...(params.maxPrice !== undefined ? { lte: params.maxPrice } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: sortOrder(params.sort),
      skip,
      take,
      select: productSelect,
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
}): Promise<PublicProductListItemDto[]> {
  const result = await searchPublicProducts({
    pageSize: params.limit,
    page: 1,
    locale: params.locale,
    marketId: params.marketId,
  });
  return result.items ?? [];
}

export async function getPublicProductById(
  productId: string,
  locale: "en" | "ar" = "en",
  marketId?: string,
): Promise<PublicProductDetailDto | null> {
  const row = await prisma.product.findFirst({
    where: {
      id: productId,
      status: "PUBLISHED",
      ...(marketId ? { marketId } : {}),
    },
    select: {
      ...productSelect,
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
