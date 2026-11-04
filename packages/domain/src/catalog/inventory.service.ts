import type { Prisma } from "@mlm/db";

export class InventoryError extends Error {
  constructor(
    public readonly code: "INSUFFICIENT_STOCK" | "OFFER_NOT_FOUND",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "InventoryError";
  }
}

type StockLine = {
  productId: string;
  productName: string;
  quantity: number;
  variantId?: string | null;
  vandsoqMode?: string | null;
  stockLocation?: string | null;
};

/** ON_ORDER warehouse lines are made after purchase — skip hard stock check. */
export function requiresStockReservation(line: {
  vandsoqMode?: string | null;
  stockLocation?: string | null;
  fulfillmentType?: string | null;
}): boolean {
  if (line.vandsoqMode === "ON_ORDER" || line.fulfillmentType === "ON_ORDER") return false;
  return true;
}

/**
 * Ensure each line has enough APPROVED-market offer quantity. Throws InventoryError.
 */
export async function assertMarketOfferStock(
  tx: Prisma.TransactionClient,
  marketId: string,
  lines: StockLine[],
): Promise<void> {
  for (const line of lines) {
    if (!requiresStockReservation(line)) continue;

    if (line.variantId) {
      const variantOffer = await tx.productVariantOffer.findUnique({
        where: {
          variantId_marketId: { variantId: line.variantId, marketId },
        },
        select: {
          quantity: true,
          variant: { select: { title: true, isActive: true, productId: true } },
        },
      });
      if (
        !variantOffer ||
        !variantOffer.variant.isActive ||
        variantOffer.variant.productId !== line.productId
      ) {
        throw new InventoryError(
          "OFFER_NOT_FOUND",
          `Variant for "${line.productName}" is not available in this market.`,
        );
      }
      const marketOffer = await tx.productMarketOffer.findUnique({
        where: { productId_marketId: { productId: line.productId, marketId } },
        select: { status: true, vandsoqMode: true },
      });
      if (!marketOffer || marketOffer.status !== "APPROVED") {
        throw new InventoryError(
          "OFFER_NOT_FOUND",
          `Product "${line.productName}" is not available in this market.`,
        );
      }
      if (marketOffer.vandsoqMode === "ON_ORDER") continue;
      if (variantOffer.quantity < line.quantity) {
        throw new InventoryError(
          "INSUFFICIENT_STOCK",
          `Not enough stock for "${line.productName}" / ${variantOffer.variant.title} (available ${variantOffer.quantity}).`,
        );
      }
      continue;
    }

    const offer = await tx.productMarketOffer.findUnique({
      where: {
        productId_marketId: { productId: line.productId, marketId },
      },
      select: { quantity: true, status: true, vandsoqMode: true },
    });
    if (!offer || offer.status !== "APPROVED") {
      throw new InventoryError(
        "OFFER_NOT_FOUND",
        `Product "${line.productName}" is not available in this market.`,
      );
    }
    if (offer.vandsoqMode === "ON_ORDER") continue;
    if (offer.quantity < line.quantity) {
      throw new InventoryError(
        "INSUFFICIENT_STOCK",
        `Not enough stock for "${line.productName}" (available ${offer.quantity}).`,
      );
    }
  }
}

/** Decrement reserved stock for paid/placed order lines. Idempotent only if called once per order. */
export async function decrementMarketOfferStock(
  tx: Prisma.TransactionClient,
  marketId: string,
  lines: StockLine[],
): Promise<void> {
  for (const line of lines) {
    if (!requiresStockReservation(line)) continue;

    if (line.variantId) {
      const variantOffer = await tx.productVariantOffer.findUnique({
        where: {
          variantId_marketId: { variantId: line.variantId, marketId },
        },
        select: {
          id: true,
          quantity: true,
          variant: { select: { title: true, isActive: true, productId: true } },
        },
      });
      const marketOffer = await tx.productMarketOffer.findUnique({
        where: { productId_marketId: { productId: line.productId, marketId } },
        select: { id: true, vandsoqMode: true, status: true },
      });
      if (
        !variantOffer ||
        !variantOffer.variant.isActive ||
        variantOffer.variant.productId !== line.productId ||
        !marketOffer ||
        marketOffer.status !== "APPROVED" ||
        marketOffer.vandsoqMode === "ON_ORDER"
      ) {
        continue;
      }
      if (variantOffer.quantity < line.quantity) {
        throw new InventoryError(
          "INSUFFICIENT_STOCK",
          `Not enough stock for "${line.productName}" / ${variantOffer.variant.title} (available ${variantOffer.quantity}).`,
        );
      }
      await tx.productVariantOffer.update({
        where: { id: variantOffer.id },
        data: { quantity: { decrement: line.quantity } },
      });
      await tx.productMarketOffer.update({
        where: { id: marketOffer.id },
        data: { quantity: { decrement: line.quantity } },
      });
      continue;
    }

    const offer = await tx.productMarketOffer.findUnique({
      where: {
        productId_marketId: { productId: line.productId, marketId },
      },
      select: { id: true, quantity: true, vandsoqMode: true, status: true },
    });
    if (!offer || offer.status !== "APPROVED" || offer.vandsoqMode === "ON_ORDER") continue;
    if (offer.quantity < line.quantity) {
      throw new InventoryError(
        "INSUFFICIENT_STOCK",
        `Not enough stock for "${line.productName}" (available ${offer.quantity}).`,
      );
    }
    await tx.productMarketOffer.update({
      where: { id: offer.id },
      data: { quantity: { decrement: line.quantity } },
    });
  }
}

/** Restock when an order is cancelled before fulfillment (best-effort). */
export async function restockMarketOfferStock(
  tx: Prisma.TransactionClient,
  marketId: string,
  lines: { productId: string; quantity: number; vandsoqMode?: string | null }[],
): Promise<void> {
  for (const line of lines) {
    if (line.vandsoqMode === "ON_ORDER") continue;
    if (!line.productId || line.quantity <= 0) continue;
    await tx.productMarketOffer.updateMany({
      where: {
        productId: line.productId,
        marketId,
        status: "APPROVED",
        vandsoqMode: { not: "ON_ORDER" },
      },
      data: { quantity: { increment: line.quantity } },
    });
  }
}
