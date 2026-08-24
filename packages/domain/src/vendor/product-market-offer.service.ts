import type { Prisma } from "@mlm/db";
import type { ProductMarketOfferInput } from "@mlm/shared";
import {
  defaultCurrencyForMarketId,
  FOURCES_WAREHOUSE_IDS,
  MARKET_IDS,
} from "@mlm/shared";

export type ProductMarketOfferDto = {
  marketId: string;
  marketCode: string;
  price: string;
  currency: string;
  stockLocation: "MERCHANT" | "FOURCES_WAREHOUSE";
  warehouseId: string | null;
  fourcesMode: "FORSEIZ_STOCK" | "ON_ORDER" | null;
  quantity: number;
};

const WAREHOUSE_BY_MARKET: Record<string, string> = {
  [MARKET_IDS.SA]: FOURCES_WAREHOUSE_IDS.SA,
  [MARKET_IDS.OM]: FOURCES_WAREHOUSE_IDS.OM,
  [MARKET_IDS.EG]: FOURCES_WAREHOUSE_IDS.EG,
};

export function warehouseIdForMarket(marketId: string): string | null {
  return WAREHOUSE_BY_MARKET[marketId] ?? null;
}

export function normalizeProductMarketOffers(
  offers: ProductMarketOfferInput[],
): ProductMarketOfferInput[] {
  return offers.map((offer) => ({
    ...offer,
    currency: offer.currency || defaultCurrencyForMarketId(offer.marketId),
    warehouseId:
      offer.stockLocation === "FOURCES_WAREHOUSE"
        ? (offer.warehouseId ?? warehouseIdForMarket(offer.marketId))
        : null,
    fourcesMode:
      offer.stockLocation === "FOURCES_WAREHOUSE"
        ? (offer.fourcesMode ?? "FORSEIZ_STOCK")
        : null,
  }));
}

export function fulfillmentTypeFromOffers(
  offers: ProductMarketOfferInput[],
): "DIRECT" | "FORSEIZ_STOCK" | "ON_ORDER" {
  const fources = offers.filter((o) => o.stockLocation === "FOURCES_WAREHOUSE");
  if (fources.length === 0) return "DIRECT";
  if (fources.some((o) => o.fourcesMode === "ON_ORDER")) return "ON_ORDER";
  return "FORSEIZ_STOCK";
}

/** Replace all market offers for a product (transaction client). */
export async function replaceProductMarketOffers(
  tx: Prisma.TransactionClient,
  productId: string,
  offers: ProductMarketOfferInput[],
): Promise<void> {
  await tx.productMarketOffer.deleteMany({ where: { productId } });
  if (offers.length === 0) return;

  await tx.productMarketOffer.createMany({
    data: offers.map((offer) => ({
      productId,
      marketId: offer.marketId,
      price: offer.price,
      currency: offer.currency,
      stockLocation: offer.stockLocation,
      warehouseId:
        offer.stockLocation === "FOURCES_WAREHOUSE"
          ? (offer.warehouseId ?? warehouseIdForMarket(offer.marketId))
          : null,
      fourcesMode:
        offer.stockLocation === "FOURCES_WAREHOUSE"
          ? (offer.fourcesMode ?? "FORSEIZ_STOCK")
          : null,
      quantity: offer.quantity,
    })),
  });
}

export function pickHomeOffer(
  offers: ProductMarketOfferInput[],
  vendorMarketId: string,
): ProductMarketOfferInput {
  return offers.find((o) => o.marketId === vendorMarketId) ?? offers[0]!;
}
