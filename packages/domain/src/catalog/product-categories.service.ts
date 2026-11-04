import { prisma, Prisma } from "@mlm/db";

export type PublicCategoryDto = {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  productCount: number;
  /** Primary image from a recent published product in this category, if any. */
  coverImageUrl: string | null;
  children?: PublicCategoryDto[];
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
      parentId: true,
      nameEn: true,
      nameAr: true,
      _count: {
        select: {
          products: {
            where: {
              status: "PUBLISHED",
              vendor: { storeApprovalStatus: "APPROVED" },
            },
          },
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
      INNER JOIN vendors v ON v.id = p.vendor_id
      WHERE p.status = 'PUBLISHED'
        AND v.store_approval_status = 'APPROVED'
        AND p.category_id IN (${Prisma.join(ids)})
      ORDER BY p.category_id, pi.is_primary DESC, pi.sort_order ASC, p.updated_at DESC
    `;
    coverById = new Map(covers.map((c) => [c.category_id, c.url]));
  }

  const flat: PublicCategoryDto[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    parentId: row.parentId,
    name: locale === "ar" ? row.nameAr : row.nameEn,
    productCount: row._count.products,
    coverImageUrl: coverById.get(row.id) ?? null,
  }));

  // Flat list keeps existing catalog/vendor filters working; parentId enables trees in UI.
  return flat;
}

/** Nested tree for nav (roots only; children attached). */
export function buildCategoryTree(flat: PublicCategoryDto[]): PublicCategoryDto[] {
  const byId = new Map<string, PublicCategoryDto>();
  for (const row of flat) {
    byId.set(row.id, { ...row, children: [] });
  }
  const roots: PublicCategoryDto[] = [];
  for (const row of byId.values()) {
    if (row.parentId && byId.has(row.parentId)) {
      byId.get(row.parentId)!.children!.push(row);
    } else {
      roots.push(row);
    }
  }
  return roots;
}

/** Self + all descendants (BFS). */
export async function collectCategoryAndDescendantIds(
  categoryId: string,
  marketId: string,
): Promise<string[]> {
  const rows = await prisma.productCategory.findMany({
    where: { marketId, isActive: true },
    select: { id: true, parentId: true },
  });
  const childrenOf = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    const list = childrenOf.get(row.parentId) ?? [];
    list.push(row.id);
    childrenOf.set(row.parentId, list);
  }
  const out: string[] = [];
  const queue = [categoryId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const child of childrenOf.get(id) ?? []) queue.push(child);
  }
  return out;
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
