import { prisma } from "@mlm/db";
import type { AdminProductCategoryUpsertInput } from "@mlm/shared";

export type AdminProductCategoryDto = {
  id: string;
  marketId: string;
  parentId: string | null;
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
      parentId: true,
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
    parentId: row.parentId,
    slug: row.slug,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    productCount: row._count.products,
  }));
}

async function assertValidParent(params: {
  marketId: string;
  categoryId?: string;
  parentId: string | null | undefined;
}): Promise<string | null> {
  if (params.parentId == null || params.parentId === "") return null;
  if (params.categoryId && params.parentId === params.categoryId) {
    throw new Error("INVALID_PARENT");
  }
  const parent = await prisma.productCategory.findFirst({
    where: { id: params.parentId, marketId: params.marketId },
    select: { id: true, parentId: true },
  });
  if (!parent) throw new Error("INVALID_PARENT");
  // Prevent cycles: walk ancestors
  let cursor: string | null = parent.parentId;
  const seen = new Set<string>([parent.id]);
  while (cursor) {
    if (params.categoryId && cursor === params.categoryId) throw new Error("INVALID_PARENT");
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const next: { parentId: string | null } | null = await prisma.productCategory.findFirst({
      where: { id: cursor, marketId: params.marketId },
      select: { parentId: true },
    });
    cursor = next?.parentId ?? null;
  }
  return parent.id;
}

export async function createAdminProductCategory(params: {
  marketId: string;
  input: AdminProductCategoryUpsertInput;
}): Promise<AdminProductCategoryDto> {
  const parentId = await assertValidParent({
    marketId: params.marketId,
    parentId: params.input.parentId,
  });
  const row = await prisma.productCategory.create({
    data: {
      marketId: params.marketId,
      parentId,
      slug: params.input.slug,
      nameEn: params.input.nameEn,
      nameAr: params.input.nameAr,
      sortOrder: params.input.sortOrder ?? 0,
      isActive: params.input.isActive ?? true,
    },
    select: {
      id: true,
      marketId: true,
      parentId: true,
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
    parentId: row.parentId,
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

  const parentId =
    params.input.parentId !== undefined
      ? await assertValidParent({
          marketId: params.marketId,
          categoryId: params.categoryId,
          parentId: params.input.parentId,
        })
      : undefined;

  const row = await prisma.productCategory.update({
    where: { id: params.categoryId },
    data: {
      ...(params.input.slug !== undefined ? { slug: params.input.slug } : {}),
      ...(params.input.nameEn !== undefined ? { nameEn: params.input.nameEn } : {}),
      ...(params.input.nameAr !== undefined ? { nameAr: params.input.nameAr } : {}),
      ...(parentId !== undefined ? { parentId } : {}),
      ...(params.input.sortOrder !== undefined ? { sortOrder: params.input.sortOrder } : {}),
      ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
    },
    select: {
      id: true,
      marketId: true,
      parentId: true,
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
    parentId: row.parentId,
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
    select: {
      id: true,
      _count: { select: { products: true, children: true } },
    },
  });
  if (!existing) throw new Error("NOT_FOUND");
  if (existing._count.products > 0) throw new Error("HAS_PRODUCTS");
  if (existing._count.children > 0) throw new Error("HAS_CHILDREN");
  await prisma.productCategory.delete({ where: { id: params.categoryId } });
}
