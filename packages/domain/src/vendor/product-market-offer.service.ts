import type { Prisma, ProductMarketOfferStatus } from "@mlm/db";
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
  status: ProductMarketOfferStatus;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
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

function offerFingerprint(offer: {
  price: { toString(): string } | number | string;
  currency: string;
  stockLocation: string;
  warehouseId: string | null;
  fourcesMode: string | null;
  quantity: number;
}): string {
  return [
    Number(offer.price).toFixed(2),
    offer.currency,
    offer.stockLocation,
    offer.warehouseId ?? "",
    offer.fourcesMode ?? "",
    String(offer.quantity),
  ].join("|");
}

export type ReplaceOffersMode = "draft" | "preserve_approved" | "pending";

/**
 * Replace all market offers for a product.
 * - draft: all DRAFT (create/update before submit)
 * - pending: all PENDING (product submit)
 * - preserve_approved: keep APPROVED if fingerprint unchanged; else PENDING
 */
export async function replaceProductMarketOffers(
  tx: Prisma.TransactionClient,
  productId: string,
  offers: ProductMarketOfferInput[],
  mode: ReplaceOffersMode = "draft",
): Promise<void> {
  const existing =
    mode === "preserve_approved"
      ? await tx.productMarketOffer.findMany({
          where: { productId },
          select: {
            marketId: true,
            status: true,
            price: true,
            currency: true,
            stockLocation: true,
            warehouseId: true,
            fourcesMode: true,
            quantity: true,
            reviewedAt: true,
            reviewedByUserId: true,
          },
        })
      : [];
  const existingByMarket = new Map(existing.map((row) => [row.marketId, row]));

  await tx.productMarketOffer.deleteMany({ where: { productId } });
  if (offers.length === 0) return;

  const now = new Date();
  await tx.productMarketOffer.createMany({
    data: offers.map((offer) => {
      const warehouseId =
        offer.stockLocation === "FOURCES_WAREHOUSE"
          ? (offer.warehouseId ?? warehouseIdForMarket(offer.marketId))
          : null;
      const fourcesMode =
        offer.stockLocation === "FOURCES_WAREHOUSE"
          ? (offer.fourcesMode ?? "FORSEIZ_STOCK")
          : null;

      let status: ProductMarketOfferStatus = "DRAFT";
      let submittedAt: Date | null = null;
      let reviewedAt: Date | null = null;
      let reviewedByUserId: string | null = null;

      if (mode === "pending") {
        status = "PENDING";
        submittedAt = now;
      } else if (mode === "preserve_approved") {
        const prior = existingByMarket.get(offer.marketId);
        const nextFp = offerFingerprint({
          price: offer.price,
          currency: offer.currency,
          stockLocation: offer.stockLocation,
          warehouseId,
          fourcesMode,
          quantity: offer.quantity,
        });
        if (
          prior?.status === "APPROVED" &&
          offerFingerprint(prior) === nextFp
        ) {
          status = "APPROVED";
          reviewedAt = prior.reviewedAt;
          reviewedByUserId = prior.reviewedByUserId;
        } else {
          status = "PENDING";
          submittedAt = now;
        }
      }

      return {
        productId,
        marketId: offer.marketId,
        price: offer.price,
        currency: offer.currency,
        stockLocation: offer.stockLocation,
        warehouseId,
        fourcesMode,
        quantity: offer.quantity,
        status,
        submittedAt,
        reviewedAt,
        reviewedByUserId,
        rejectionReason: null,
      };
    }),
  });
}

export async function markProductOffersPending(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<void> {
  await tx.productMarketOffer.updateMany({
    where: { productId, status: { in: ["DRAFT", "REJECTED"] } },
    data: {
      status: "PENDING",
      submittedAt: new Date(),
      rejectionReason: null,
      reviewedAt: null,
      reviewedByUserId: null,
    },
  });
}

/** Approve home-market offer when the product itself is approved for first publish. */
export async function approveHomeMarketOffer(
  tx: Prisma.TransactionClient,
  productId: string,
  homeMarketId: string,
  reviewedByUserId?: string | null,
): Promise<void> {
  await tx.productMarketOffer.updateMany({
    where: {
      productId,
      marketId: homeMarketId,
      status: { in: ["PENDING", "DRAFT", "REJECTED"] },
    },
    data: {
      status: "APPROVED",
      reviewedAt: new Date(),
      reviewedByUserId: reviewedByUserId ?? null,
      rejectionReason: null,
    },
  });
  // Ensure non-home pending offers stay pending (submitted) for market queue.
  await tx.productMarketOffer.updateMany({
    where: {
      productId,
      marketId: { not: homeMarketId },
      status: { in: ["DRAFT", "REJECTED"] },
    },
    data: {
      status: "PENDING",
      submittedAt: new Date(),
      rejectionReason: null,
    },
  });
}

export function pickHomeOffer(
  offers: ProductMarketOfferInput[],
  vendorMarketId: string,
): ProductMarketOfferInput {
  return offers.find((o) => o.marketId === vendorMarketId) ?? offers[0]!;
}

/** Catalog / cart: offer must be approved for the active market. */
export const approvedOfferInMarket = (marketId: string) => ({
  marketId,
  status: "APPROVED" as const,
});
