import { MARKET_IDS } from "@mlm/shared";
import { Prisma, prisma } from "@mlm/db";
import { getLatestFxRate } from "./fx-rate.service";

/**
 * Phase 4 — International dual price: keep USD as fixed offer currency and
 * refresh secondary OMR from the latest USD→OMR admin FX rate.
 */
export async function syncGlobalOfferOmrFromUsd(params?: {
  usdToOmrRate?: number | null;
}): Promise<{ updated: number; rate: number | null }> {
  const rate =
    params?.usdToOmrRate ??
    (await getLatestFxRate("USD", "OMR")) ??
    (() => null)();

  // Also accept inverse OMR→USD if only that side was entered.
  let effective = rate;
  if (effective == null) {
    const inverse = await getLatestFxRate("OMR", "USD");
    if (inverse != null && inverse > 0) effective = 1 / inverse;
  }
  if (effective == null || !Number.isFinite(effective) || effective <= 0) {
    return { updated: 0, rate: null };
  }

  const offers = await prisma.productMarketOffer.findMany({
    where: {
      marketId: MARKET_IDS.GLOBAL,
      currency: "USD",
    },
    select: { id: true, price: true },
  });

  let updated = 0;
  for (const offer of offers) {
    const secondary = new Prisma.Decimal(
      (Math.round(Number(offer.price) * effective * 1000) / 1000).toFixed(3),
    );
    await prisma.productMarketOffer.update({
      where: { id: offer.id },
      data: {
        secondaryPrice: secondary,
        secondaryCurrency: "OMR",
      },
    });
    updated += 1;
  }

  return { updated, rate: effective };
}
