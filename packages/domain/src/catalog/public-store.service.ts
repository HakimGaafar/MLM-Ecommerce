import type { PaginatedResult } from "@mlm/shared";
import { buildPaginatedResult, normalizePagination } from "@mlm/shared";
import { prisma } from "@mlm/db";

export type PublicStoreListItemDto = {
  id: string;
  storeName: string;
  slug: string;
  city: string;
  countryCode: string;
  productCount: number;
};

export type PublicStoreProductDto = {
  id: string;
  name: string;
  price: string;
  currency: string;
  categoryId: string;
  categoryName: string;
  imageUrl: string | null;
};

export type PublicStoreDetailDto = {
  id: string;
  storeName: string;
  slug: string;
  countryCode: string;
  city: string;
  state: string | null;
  addressLine1: string;
  addressLine2: string | null;
  postalCode: string;
  about: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  planCode: string;
  metaTitle: string | null;
  metaDescription: string | null;
  products: PublicStoreProductDto[];
};

export async function listPublicStores(params: {
  page: number;
  pageSize: number;
  marketId: string;
}): Promise<PaginatedResult<PublicStoreListItemDto>> {
  const { page, pageSize, skip, take } = normalizePagination(params);

  const [rows, total] = await prisma.$transaction([
    prisma.vendor.findMany({
      where: { marketId: params.marketId },
      orderBy: { storeName: "asc" },
      skip,
      take,
      select: {
        id: true,
        storeName: true,
        slug: true,
        city: true,
        countryCode: true,
        _count: { select: { products: { where: { status: "PUBLISHED" } } } },
      },
    }),
    prisma.vendor.count({ where: { marketId: params.marketId } }),
  ]);

  return buildPaginatedResult(
    rows.map((v) => ({
      id: v.id,
      storeName: v.storeName,
      slug: v.slug,
      city: v.city,
      countryCode: v.countryCode,
      productCount: v._count.products,
    })),
    total,
    page,
    pageSize,
  );
}

export async function listPublicStoreProducts(params: {
  vendorId: string;
  page?: number;
  pageSize?: number;
  locale?: "en" | "ar";
}): Promise<PaginatedResult<PublicStoreProductDto>> {
  const locale = params.locale ?? "en";
  const { page, pageSize, skip, take } = normalizePagination(params);
  const where = { vendorId: params.vendorId, status: "PUBLISHED" as const };
  const [rows, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        name: true,
        price: true,
        currency: true,
        categoryId: true,
        category: { select: { nameEn: true, nameAr: true } },
        images: {
          orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
          select: { url: true, isPrimary: true },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);
  return buildPaginatedResult(
    rows.map((p) => {
      const primary = p.images.find((i) => i.isPrimary) ?? p.images[0];
      return {
        id: p.id,
        name: p.name,
        price: p.price.toString(),
        currency: p.currency,
        categoryId: p.categoryId,
        categoryName: locale === "ar" ? p.category.nameAr : p.category.nameEn,
        imageUrl: primary?.url ?? null,
      };
    }),
    total,
    page,
    pageSize,
  );
}

export async function getPublicStoreBySlug(
  slug: string,
  locale: "en" | "ar" = "en",
  marketId?: string,
): Promise<PublicStoreDetailDto | null> {
  const normalized = slug.trim().toLowerCase();
  const vendor = await prisma.vendor.findFirst({
    where: {
      slug: normalized,
      ...(marketId ? { marketId } : {}),
    },
    include: {
      products: {
        where: { status: "PUBLISHED" },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          price: true,
          currency: true,
          categoryId: true,
          category: { select: { nameEn: true, nameAr: true } },
          images: {
            orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
            select: { url: true, isPrimary: true },
          },
        },
      },
    },
  });
  if (!vendor) return null;

  return {
    id: vendor.id,
    storeName: vendor.storeName,
    slug: vendor.slug,
    countryCode: vendor.countryCode,
    city: vendor.city,
    state: vendor.state,
    addressLine1: vendor.addressLine1,
    addressLine2: vendor.addressLine2,
    postalCode: vendor.postalCode,
    about: vendor.about,
    logoUrl: vendor.logoUrl,
    bannerUrl: vendor.bannerUrl,
    planCode: vendor.planCode,
    metaTitle: vendor.metaTitle,
    metaDescription: vendor.metaDescription,
    products: vendor.products.map((p) => {
      const primary = p.images.find((i) => i.isPrimary) ?? p.images[0];
      return {
        id: p.id,
        name: p.name,
        price: p.price.toString(),
        currency: p.currency,
        categoryId: p.categoryId,
        categoryName: locale === "ar" ? p.category.nameAr : p.category.nameEn,
        imageUrl: primary?.url ?? null,
      };
    }),
  };
}
