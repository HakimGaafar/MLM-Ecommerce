import { prisma } from "@mlm/db";
import type { CatalogDeliveryContext } from "../catalog/catalog-delivery-context.service";
import {
  findPublishedProductsByIds,
  type PublicProductListItemDto,
} from "../catalog/public-catalog.service";

export class WishlistError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "PRODUCT_UNAVAILABLE",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "WishlistError";
  }
}

export type WishlistItemDto = {
  id: string;
  productId: string;
  createdAt: string;
  product: PublicProductListItemDto | null;
};

export async function listWishlist(
  userId: string,
  marketId: string,
  locale: "en" | "ar" = "en",
  delivery?: CatalogDeliveryContext | null,
): Promise<WishlistItemDto[]> {
  const rows = await prisma.wishlistItem.findMany({
    where: { userId, marketId },
    orderBy: { createdAt: "desc" },
    select: { id: true, productId: true, createdAt: true },
  });
  if (rows.length === 0) return [];

  const products = await findPublishedProductsByIds(
    rows.map((r) => r.productId),
    locale,
    marketId,
    delivery,
  );
  const byId = new Map(products.map((p) => [p.id, p]));

  return rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    createdAt: row.createdAt.toISOString(),
    product: byId.get(row.productId) ?? null,
  }));
}

export async function isProductInWishlist(
  userId: string,
  marketId: string,
  productId: string,
): Promise<boolean> {
  const row = await prisma.wishlistItem.findUnique({
    where: {
      userId_marketId_productId: { userId, marketId, productId },
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function addToWishlist(
  userId: string,
  marketId: string,
  productId: string,
): Promise<WishlistItemDto> {
  const offer = await prisma.productMarketOffer.findUnique({
    where: { productId_marketId: { productId, marketId } },
    select: { status: true, product: { select: { status: true } } },
  });
  if (!offer || offer.status !== "APPROVED" || offer.product.status !== "PUBLISHED") {
    throw new WishlistError("PRODUCT_UNAVAILABLE", "Product is not available in this market.");
  }

  const row = await prisma.wishlistItem.upsert({
    where: {
      userId_marketId_productId: { userId, marketId, productId },
    },
    create: { userId, marketId, productId },
    update: {},
    select: { id: true, productId: true, createdAt: true },
  });

  return {
    id: row.id,
    productId: row.productId,
    createdAt: row.createdAt.toISOString(),
    product: null,
  };
}

export async function removeFromWishlist(
  userId: string,
  marketId: string,
  productId: string,
): Promise<void> {
  const existing = await prisma.wishlistItem.findUnique({
    where: {
      userId_marketId_productId: { userId, marketId, productId },
    },
    select: { id: true },
  });
  if (!existing) {
    throw new WishlistError("NOT_FOUND", "Wishlist item not found.");
  }
  await prisma.wishlistItem.delete({ where: { id: existing.id } });
}
