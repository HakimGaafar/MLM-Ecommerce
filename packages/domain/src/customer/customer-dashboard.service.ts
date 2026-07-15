import { prisma } from "@mlm/db";
import type { PublicProductListItemDto } from "../catalog/public-catalog.service";
import { findPublishedProductsByIds, searchPublicProducts } from "../catalog/public-catalog.service";
import { listPublicCategories, type PublicCategoryDto } from "../catalog/product-categories.service";

function displayFirstName(fullName: string): string {
  const t = fullName.trim();
  if (!t) return "";
  return t.split(/\s+/)[0] ?? t;
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

async function topCategoryIdsForBuyer(buyerUserId: string, marketId: string, take: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ category_id: string }[]>`
    SELECT p.category_id AS category_id
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    INNER JOIN products p ON p.id = oi.product_id
    WHERE o.buyer_user_id = ${buyerUserId}
      AND o.market_id = ${marketId}
      AND o.status::text != ${"CANCELLED"}
      AND oi.product_id IS NOT NULL
    GROUP BY p.category_id
    ORDER BY SUM(oi.quantity) DESC
    LIMIT ${take}
  `;
  return rows.map((r) => r.category_id);
}

async function topVendorIdsForBuyer(buyerUserId: string, marketId: string, take: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ vendor_id: string }[]>`
    SELECT oi.vendor_id AS vendor_id
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    WHERE o.buyer_user_id = ${buyerUserId}
      AND o.market_id = ${marketId}
      AND o.status::text != ${"CANCELLED"}
      AND oi.product_id IS NOT NULL
    GROUP BY oi.vendor_id
    ORDER BY SUM(oi.quantity) DESC
    LIMIT ${take}
  `;
  return rows.map((r) => r.vendor_id);
}

async function coPurchaseProductIdsForBuyer(
  buyerUserId: string,
  marketId: string,
  take: number,
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ product_id: string }[]>`
    WITH user_products AS (
      SELECT DISTINCT oi.product_id
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      WHERE o.buyer_user_id = ${buyerUserId}
        AND o.market_id = ${marketId}
        AND o.status::text != ${"CANCELLED"}
        AND oi.product_id IS NOT NULL
    ),
    co_purchase AS (
      SELECT oi2.product_id AS product_id, COUNT(*)::bigint AS cnt
      FROM order_items oi1
      INNER JOIN order_items oi2
        ON oi1.order_id = oi2.order_id
        AND oi1.product_id IS NOT NULL
        AND oi2.product_id IS NOT NULL
        AND oi2.product_id <> oi1.product_id
      INNER JOIN orders ord ON ord.id = oi1.order_id
      WHERE ord.market_id = ${marketId}
        AND ord.status::text != ${"CANCELLED"}
        AND oi1.product_id IN (SELECT product_id FROM user_products)
        AND oi2.product_id NOT IN (SELECT product_id FROM user_products)
      GROUP BY oi2.product_id
    )
    SELECT product_id FROM co_purchase
    ORDER BY cnt DESC
    LIMIT ${take}
  `;
  return rows.map((r) => r.product_id);
}

export type CustomerDashboardOverviewDto = {
  displayName: string;
  stats: { activeOrderCount: number; cartItemCount: number };
  categories: PublicCategoryDto[];
  featuredProducts: PublicProductListItemDto[];
  fromYourCategories: PublicProductListItemDto[];
  fromYourStores: PublicProductListItemDto[];
  buyersAlsoBought: PublicProductListItemDto[];
};

const PERSONAL_CATEGORY_FETCH = 4;
const PRODUCTS_PER_SIGNAL = 6;
const MAX_FROM_CATEGORIES = 12;
const MAX_FROM_STORES = 12;
const CO_PURCHASE_LIMIT = 16;
const FEATURED_LIMIT = 8;
const SHOW_ALSO_BOUGHT = 8;

/**
 * Dashboard feed: storefront discovery (Phase A), order-history signals (B), co-purchase (C).
 */
export async function getCustomerDashboardOverview(
  buyerUserId: string,
  locale: "en" | "ar",
  marketId: string,
): Promise<CustomerDashboardOverviewDto> {
  const [
    user,
    orderCount,
    cartRow,
    allCategories,
    featuredProducts,
    topCatIds,
    topVendorIds,
    coPurchaseIds,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: buyerUserId }, select: { name: true } }),
    prisma.order.count({
      where: { buyerUserId, marketId, status: { not: "CANCELLED" } },
    }),
    prisma.cart.findUnique({
      where: { userId_marketId: { userId: buyerUserId, marketId } },
      select: { _count: { select: { items: true } } },
    }),
    listPublicCategories(locale, marketId),
    searchPublicProducts({ page: 1, pageSize: FEATURED_LIMIT, sort: "newest", locale, marketId }).then(
      (r) => r.items,
    ),
    topCategoryIdsForBuyer(buyerUserId, marketId, PERSONAL_CATEGORY_FETCH),
    topVendorIdsForBuyer(buyerUserId, marketId, PERSONAL_CATEGORY_FETCH),
    coPurchaseProductIdsForBuyer(buyerUserId, marketId, CO_PURCHASE_LIMIT),
  ]);

  const displaySource = user?.name ?? "";
  const displayName = displayFirstName(displaySource) || (locale === "ar" ? "هناك" : "there");

  const categories = allCategories.filter((c) => c.productCount > 0);

  const [fromCatsNested, fromStoresNested] = await Promise.all([
    Promise.all(
      topCatIds.map((categoryId) =>
        searchPublicProducts({
          categoryId,
          page: 1,
          pageSize: PRODUCTS_PER_SIGNAL,
          sort: "newest",
          locale,
          marketId,
        }),
      ),
    ),
    Promise.all(
      topVendorIds.map((vendorId) =>
        searchPublicProducts({
          vendorId,
          page: 1,
          pageSize: PRODUCTS_PER_SIGNAL,
          sort: "newest",
          locale,
          marketId,
        }),
      ),
    ),
  ]);

  const fromYourCategories = dedupeById(fromCatsNested.flatMap((r) => r.items)).slice(0, MAX_FROM_CATEGORIES);
  const fromYourStores = dedupeById(fromStoresNested.flatMap((r) => r.items)).slice(0, MAX_FROM_STORES);

  const buyersAlsoBought = await findPublishedProductsByIds(
    coPurchaseIds.slice(0, SHOW_ALSO_BOUGHT * 2),
    locale,
    marketId,
  ).then((items) => items.slice(0, SHOW_ALSO_BOUGHT));

  return {
    displayName,
    stats: {
      activeOrderCount: orderCount,
      cartItemCount: cartRow?._count.items ?? 0,
    },
    categories,
    featuredProducts,
    fromYourCategories,
    fromYourStores,
    buyersAlsoBought,
  };
}
