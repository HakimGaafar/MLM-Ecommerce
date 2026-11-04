/**
 * Cross-market / International vendor settlement math (Phase 0 §2 + §7).
 *
 * Commission base = product eligible (post-discount merchandise), excluding shipping & tax.
 * Platform takes platformRate of that base; vendor keeps the rest of product + their DIRECT shipping.
 *
 *   vendorNet ≈ productEligible × vendorRate + directShippingShare
 *             = productEligible + directShippingShare − platformCommission
 */

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type CrossMarketVendorSettlement = {
  productEligible: number;
  platformRate: number;
  vendorRate: number;
  platformCommission: number;
  productVendorShare: number;
  directShippingShare: number;
  vendorNet: number;
};

/** Product share + DIRECT shipping; warehouse shipping stays with the platform issuer. */
export function calculateCrossMarketVendorSettlement(params: {
  productEligible: number;
  platformRate: number;
  vendorRate: number;
  directShippingShare: number;
}): CrossMarketVendorSettlement {
  const productEligible = roundMoney(Math.max(params.productEligible, 0));
  const directShippingShare = roundMoney(Math.max(params.directShippingShare, 0));
  const platformCommission = roundMoney(productEligible * params.platformRate);
  const productVendorShare = roundMoney(productEligible * params.vendorRate);
  const vendorNet = roundMoney(productVendorShare + directShippingShare);
  return {
    productEligible,
    platformRate: params.platformRate,
    vendorRate: params.vendorRate,
    platformCommission,
    productVendorShare,
    directShippingShare,
    vendorNet,
  };
}

/** Sum of DIRECT fulfillment shipping lines for a vendor (warehouse fees excluded). */
export function getVendorDirectShippingShare(params: {
  vendorId: string;
  vendorShippingLines: { vendorId: string; fulfillmentType: string; fee: number | string }[];
}): number {
  return roundMoney(
    params.vendorShippingLines
      .filter((line) => line.vendorId === params.vendorId && line.fulfillmentType === "DIRECT")
      .reduce((sum, line) => sum + Number(line.fee), 0),
  );
}

/**
 * Fallback when an order has no vendor shipping snapshot rows: allocate order shipping
 * by merchandise ratio only if the order has no warehouse shipping lines.
 */
export function allocateShippingShareFallback(params: {
  vendorMerchandise: number;
  orderSubtotal: number;
  orderShippingFee: number;
  hasWarehouseShippingLines: boolean;
}): number {
  if (params.hasWarehouseShippingLines) return 0;
  if (params.orderSubtotal <= 0 || params.orderShippingFee <= 0 || params.vendorMerchandise <= 0) {
    return 0;
  }
  const ratio = Math.min(1, params.vendorMerchandise / params.orderSubtotal);
  return roundMoney(params.orderShippingFee * ratio);
}

export function settlementTransferFeeRate(): number {
  const raw = Number.parseFloat(process.env.SETTLEMENT_TRANSFER_FEE_RATE ?? "0");
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return Math.min(raw, 1);
}

/** Home-currency snapshot at release (reference for payout; wallet ledger stays in market currency). */
export function buildCrossMarketReleaseSnapshot(params: {
  amountMarket: number;
  marketCurrency: string;
  homeCurrency: string | null;
  fxRate: number | null;
  transferFeeRate?: number;
}): {
  marketCurrency: string;
  homeCurrency: string | null;
  fxRate: number | null;
  amountHomeGross: number | null;
  transferFeeRate: number;
  transferFeeHome: number | null;
  amountHomeNet: number | null;
  fxNote: string;
} {
  const feeRate = params.transferFeeRate ?? settlementTransferFeeRate();
  const marketCurrency = params.marketCurrency.toUpperCase();
  const homeCurrency = params.homeCurrency?.toUpperCase() ?? null;

  if (!homeCurrency || homeCurrency === marketCurrency) {
    const fee = roundMoney(params.amountMarket * feeRate);
    return {
      marketCurrency,
      homeCurrency: homeCurrency ?? marketCurrency,
      fxRate: 1,
      amountHomeGross: params.amountMarket,
      transferFeeRate: feeRate,
      transferFeeHome: fee,
      amountHomeNet: roundMoney(params.amountMarket - fee),
      fxNote: "Same-currency release; transfer fee is a payout statement line only.",
    };
  }

  if (params.fxRate == null || !(params.fxRate > 0)) {
    return {
      marketCurrency,
      homeCurrency,
      fxRate: null,
      amountHomeGross: null,
      transferFeeRate: feeRate,
      transferFeeHome: null,
      amountHomeNet: null,
      fxNote:
        "No FX rate on file; amount released in wallet (market) currency. Convert at payout when a rate exists.",
    };
  }

  const amountHomeGross = roundMoney(params.amountMarket * params.fxRate);
  const transferFeeHome = roundMoney(amountHomeGross * feeRate);
  return {
    marketCurrency,
    homeCurrency,
    fxRate: params.fxRate,
    amountHomeGross,
    transferFeeRate: feeRate,
    transferFeeHome,
    amountHomeNet: roundMoney(amountHomeGross - transferFeeHome),
    fxNote:
      "Settlement-day FX snapshot for home-currency payout; ledger credit stays in market currency until bank payout.",
  };
}
