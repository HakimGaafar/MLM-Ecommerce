import { prisma, Prisma } from "@mlm/db";

export type PublicCategoryDto = {
  id: string;
  slug: string;
  name: string;
  productCount: number;
  /** Primary image from a recent published product in this category, if any. */
  coverImageUrl: string | null;
};

export async function listPublicCategories(
  locale: "en" | "ar",
  marketId: string,
): Promise<PublicCategoryDto[]> {
  const rows = await prisma.productCategory.findMany({
    where: { isActive: true, marketId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameAr: true,
      _count: {
        select: {
          products: { where: { status: "PUBLISHED" } },
        },
      },
    },
  });

  const ids = rows.map((r) => r.id);
  let coverById = new Map<string, string>();
  if (ids.length > 0) {
    const covers = await prisma.$queryRaw<{ category_id: string; url: string }[]>`
      SELECT DISTINCT ON (p.category_id)
        p.category_id AS category_id,
        pi.url AS url
      FROM products p
      INNER JOIN product_images pi ON pi.product_id = p.id
      WHERE p.status = 'PUBLISHED'
        AND p.category_id IN (${Prisma.join(ids)})
      ORDER BY p.category_id, pi.is_primary DESC, pi.sort_order ASC, p.updated_at DESC
    `;
    coverById = new Map(covers.map((c) => [c.category_id, c.url]));
  }

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: locale === "ar" ? row.nameAr : row.nameEn,
    productCount: row._count.products,
    coverImageUrl: coverById.get(row.id) ?? null,
  }));
}

export async function resolveCategoryId(params: {
  marketId: string;
  categoryId?: string;
  categorySlug?: string;
}): Promise<string | undefined> {
  if (params.categoryId) {
    const row = await prisma.productCategory.findFirst({
      where: { id: params.categoryId, isActive: true, marketId: params.marketId },
      select: { id: true },
    });
    return row?.id;
  }
  if (params.categorySlug) {
    const row = await prisma.productCategory.findFirst({
      where: { slug: params.categorySlug, isActive: true, marketId: params.marketId },
      select: { id: true },
    });
    return row?.id;
  }
  return undefined;
}

export async function assertActiveCategoryId(categoryId: string, marketId?: string): Promise<void> {
  const row = await prisma.productCategory.findFirst({
    where: {
      id: categoryId,
      isActive: true,
      ...(marketId ? { marketId } : {}),
    },
    select: { id: true },
  });
  if (!row) throw new Error("INVALID_CATEGORY");
}
