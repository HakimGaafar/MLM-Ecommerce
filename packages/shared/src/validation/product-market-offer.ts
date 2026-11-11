import { z } from "zod";
import { MARKET_IDS, type MarketCode } from "../market";
import { PRODUCT_STOCK_LOCATIONS } from "../commerce-fulfillment";

/** Any market row id (seed market_* or wizard cuid). */
const MarketIdSchema = z.string().trim().min(1).max(64);

export const ProductMarketOfferInputSchema = z
  .object({
    marketId: MarketIdSchema,
    price: z.coerce.number().positive().max(1_000_000),
    currency: z.string().trim().length(3).toUpperCase(),
    stockLocation: z.enum(PRODUCT_STOCK_LOCATIONS),
    warehouseId: z.string().trim().min(1).nullable().optional(),
    vandsoqMode: z.enum(["FORSEIZ_STOCK", "ON_ORDER"]).nullable().optional(),
    quantity: z.coerce.number().int().min(0).max(1_000_000),
  })
  .superRefine((value, ctx) => {
    if (value.stockLocation === "VANDSOQ_WAREHOUSE") {
      if (!value.warehouseId) {
        ctx.addIssue({
          code: "custom",
          message: "VANDSOQ warehouse is required for warehouse stock.",
          path: ["warehouseId"],
        });
      }
      if (value.marketId === MARKET_IDS.GLOBAL) {
        ctx.addIssue({
          code: "custom",
          message: "VANDSOQ warehouses are only available in Saudi Arabia, Oman, and Egypt.",
          path: ["stockLocation"],
        });
      }
      if (!value.vandsoqMode) {
        ctx.addIssue({
          code: "custom",
          message: "Select VANDSOQ stock mode (pre-stocked or on-order).",
          path: ["vandsoqMode"],
        });
      }
    }
  });

export const ProductMarketOffersSchema = z
  .array(ProductMarketOfferInputSchema)
  .min(1, { message: "Select at least one market to sell in." })
  .superRefine((offers, ctx) => {
    const seen = new Set<string>();
    for (const [index, offer] of offers.entries()) {
      if (seen.has(offer.marketId)) {
        ctx.addIssue({
          code: "custom",
          message: "Each market can only be selected once.",
          path: [index, "marketId"],
        });
      }
      seen.add(offer.marketId);
    }
  });

export type ProductMarketOfferInput = z.infer<typeof ProductMarketOfferInputSchema>;

export const MARKET_CURRENCY: Record<string, string> = {
  [MARKET_IDS.SA]: "SAR",
  [MARKET_IDS.OM]: "OMR",
  [MARKET_IDS.EG]: "EGP",
  [MARKET_IDS.GLOBAL]: "USD",
};

export function defaultCurrencyForMarketId(marketId: string): string {
  return MARKET_CURRENCY[marketId] ?? "USD";
}

/** Seed-only reverse map. Wizard markets must resolve code from DB at call site. */
export function marketCodeFromMarketId(marketId: string): MarketCode | null {
  const entry = Object.entries(MARKET_IDS).find(([, id]) => id === marketId);
  return entry ? (entry[0] as MarketCode) : null;
}
