import type { ProductVariantInput } from "@mlm/shared";
import type { Prisma } from "@mlm/db";
import { prisma } from "@mlm/db";

type Db = Prisma.TransactionClient | typeof prisma;

export type VendorProductVariantDto = {
  id: string;
  title: string;
  sku: string | null;
  options: Record<string, string>;
  sortOrder: number;
  isActive: boolean;
  offers: {
    marketId: string;
    price: string;
    currency: string;
    quantity: number;
  }[];
};

export type PublicProductVariantDto = {
  id: string;
  title: string;
  sku: string | null;
  options: Record<string, string>;
  price: string;
  currency: string;
  quantity: number;
  inStock: boolean;
};

function asOptions(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" && k.trim()) out[k.trim()] = v.trim();
  }
  return out;
}

/** Replace all variants for a product. Syncs market-offer quantity to sum of variant qtys. */
export async function replaceProductVariants(
  tx: Db,
  productId: string,
  variants: ProductVariantInput[] | undefined,
): Promise<void> {
  if (variants === undefined) return;

  await tx.productVariant.deleteMany({ where: { productId } });
  if (variants.length === 0) return;

  for (const [index, variant] of variants.entries()) {
    const created = await tx.productVariant.create({
      data: {
        productId,
        title: variant.title,
        sku: variant.sku ?? null,
        optionsJson: variant.options ?? {},
        sortOrder: variant.sortOrder ?? index,
        isActive: variant.isActive !== false,
        offers: {
          create: variant.offers.map((o) => ({
            marketId: o.marketId,
            price: o.price,
            currency: o.currency,
            quantity: o.quantity,
          })),
        },
      },
      select: { id: true },
    });
    void created;
  }

  const qtyByMarket = new Map<string, number>();
  for (const variant of variants) {
    if (variant.isActive === false) continue;
    for (const offer of variant.offers) {
      qtyByMarket.set(offer.marketId, (qtyByMarket.get(offer.marketId) ?? 0) + offer.quantity);
    }
  }
  for (const [marketId, quantity] of qtyByMarket) {
    await tx.productMarketOffer.updateMany({
      where: { productId, marketId },
      data: { quantity },
    });
  }
}

export async function listVendorProductVariants(productId: string): Promise<VendorProductVariantDto[]> {
  const rows = await prisma.productVariant.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      offers: {
        orderBy: { marketId: "asc" },
        select: { marketId: true, price: true, currency: true, quantity: true },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    sku: row.sku,
    options: asOptions(row.optionsJson),
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    offers: row.offers.map((o) => ({
      marketId: o.marketId,
      price: o.price.toString(),
      currency: o.currency,
      quantity: o.quantity,
    })),
  }));
}

export async function listPublicProductVariants(
  productId: string,
  marketId: string,
): Promise<PublicProductVariantDto[]> {
  const rows = await prisma.productVariant.findMany({
    where: { productId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      offers: {
        where: { marketId },
        take: 1,
        select: { price: true, currency: true, quantity: true },
      },
    },
  });
  return rows
    .filter((row) => row.offers[0])
    .map((row) => {
      const offer = row.offers[0]!;
      return {
        id: row.id,
        title: row.title,
        sku: row.sku,
        options: asOptions(row.optionsJson),
        price: offer.price.toString(),
        currency: offer.currency,
        quantity: offer.quantity,
        inStock: offer.quantity > 0,
      };
    });
}

export async function productHasActiveVariants(productId: string, db: Db = prisma): Promise<boolean> {
  const count = await db.productVariant.count({
    where: { productId, isActive: true },
  });
  return count > 0;
}
