import { prisma } from "@mlm/db";
import type { CatalogDeliveryContext } from "./catalog-delivery-context.service";
import {
  findPublishedProductsByIds,
  searchPublicProducts,
  type PublicProductListItemDto,
} from "./public-catalog.service";

const RELATED_LIMIT = 8;
const CO_PURCHASE_FETCH = 12;
const CATEGORY_FETCH = 8;

async function coPurchaseProductIds(productId: string, marketId: string, take: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ product_id: string }[]>`
    SELECT oi2.product_id AS product_id, COUNT(*)::bigint AS cnt
    FROM order_items oi1
    INNER JOIN order_items oi2
      ON oi1.order_id = oi2.order_id
      AND oi2.product_id IS NOT NULL
      AND oi2.product_id <> oi1.product_id
    INNER JOIN orders o ON o.id = oi1.order_id
    WHERE oi1.product_id = ${productId}
      AND o.market_id = ${marketId}
      AND o.status::text != ${"CANCELLED"}
    GROUP BY oi2.product_id
    ORDER BY cnt DESC
    LIMIT ${take}
  `;
  return rows.map((r) => r.product_id);
}

function dedupeById(items: PublicProductListItemDto[]): PublicProductListItemDto[] {
  const seen = new Set<string>();
  const out: PublicProductListItemDto[] = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

/**
 * Related products for PDP: co-purchase first, then same-category fill.
 */
export async function getRelatedProductsForProduct(params: {
  productId: string;
  categoryId: string;
  marketId: string;
  locale?: "en" | "ar";
  delivery?: CatalogDeliveryContext | null;
  limit?: number;
}): Promise<PublicProductListItemDto[]> {
  const locale = params.locale ?? "en";
  const limit = params.limit ?? RELATED_LIMIT;

  const coIds = await coPurchaseProductIds(params.productId, params.marketId, CO_PURCHASE_FETCH);
  const coProducts = await findPublishedProductsByIds(
    coIds.filter((id) => id !== params.productId),
    locale,
    params.marketId,
    params.delivery,
  );

  let related = dedupeById(coProducts).slice(0, limit);
  if (related.length >= limit) return related;

  const categoryPage = await searchPublicProducts({
    categoryId: params.categoryId,
    page: 1,
    pageSize: CATEGORY_FETCH + 4,
    sort: "newest",
    locale,
    marketId: params.marketId,
    delivery: params.delivery,
  });
  const fill = categoryPage.items.filter(
    (p) => p.id !== params.productId && !related.some((r) => r.id === p.id),
  );
  related = dedupeById([...related, ...fill]).slice(0, limit);
  return related;
}
