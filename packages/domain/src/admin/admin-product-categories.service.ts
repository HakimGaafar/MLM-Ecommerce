import { prisma } from "@mlm/db";
import type { AdminProductCategoryUpsertInput } from "@mlm/shared";

export type AdminProductCategoryDto = {
  id: string;
  marketId: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
};

export async function listAdminProductCategories(marketId: string): Promise<AdminProductCategoryDto[]> {
  const rows = await prisma.productCategory.findMany({
    where: { marketId },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    select: {
      id: true,
      marketId: true,
      slug: true,
      nameEn: true,
      nameAr: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { products: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    marketId: row.marketId,
    slug: row.slug,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    productCount: row._count.products,
  }));
}

export async function createAdminProductCategory(params: {
  marketId: string;
  input: AdminProductCategoryUpsertInput;
}): Promise<AdminProductCategoryDto> {
  const row = await prisma.productCategory.create({
    data: {
      marketId: params.marketId,
      slug: params.input.slug,
      nameEn: params.input.nameEn,
      nameAr: params.input.nameAr,
      sortOrder: params.input.sortOrder ?? 0,
      isActive: params.input.isActive ?? true,
    },
    select: {
      id: true,
      marketId: true,
      slug: true,
      nameEn: true,
      nameAr: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { products: true } },
    },
  });
  return {
    id: row.id,
    marketId: row.marketId,
    slug: row.slug,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    productCount: row._count.products,
  };
}

export async function updateAdminProductCategory(params: {
  categoryId: string;
  marketId: string;
  input: Partial<AdminProductCategoryUpsertInput>;
}): Promise<AdminProductCategoryDto> {
  const existing = await prisma.productCategory.findFirst({
    where: { id: params.categoryId, marketId: params.marketId },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  const row = await prisma.productCategory.update({
    where: { id: params.categoryId },
    data: {
      ...(params.input.slug !== undefined ? { slug: params.input.slug } : {}),
      ...(params.input.nameEn !== undefined ? { nameEn: params.input.nameEn } : {}),
      ...(params.input.nameAr !== undefined ? { nameAr: params.input.nameAr } : {}),
      ...(params.input.sortOrder !== undefined ? { sortOrder: params.input.sortOrder } : {}),
      ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
    },
    select: {
      id: true,
      marketId: true,
      slug: true,
      nameEn: true,
      nameAr: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { products: true } },
    },
  });
  return {
    id: row.id,
    marketId: row.marketId,
    slug: row.slug,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    productCount: row._count.products,
  };
}

export async function deleteAdminProductCategory(params: {
  categoryId: string;
  marketId: string;
}): Promise<void> {
  const existing = await prisma.productCategory.findFirst({
    where: { id: params.categoryId, marketId: params.marketId },
    select: { id: true, _count: { select: { products: true } } },
  });
  if (!existing) throw new Error("NOT_FOUND");
  if (existing._count.products > 0) throw new Error("HAS_PRODUCTS");
  await prisma.productCategory.delete({ where: { id: params.categoryId } });
}
