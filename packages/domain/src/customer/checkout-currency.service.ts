import { MARKET_PAYMENT_CURRENCIES, getMarketCodeById, type MarketCode } from "@mlm/shared";
import { convertAmount, getLatestFxRate } from "../fx/fx-rate.service";

export class CheckoutCurrencyError extends Error {
  constructor(
    public readonly code: "FX_RATE_MISSING" | "INVALID_PAYMENT_CURRENCY",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "CheckoutCurrencyError";
  }
}

export type CheckoutCurrencyPlan = {
  cartCurrency: string;
  chargeCurrency: string;
  ledgerCurrency: string;
  /** Multiply cart-currency amounts by this to get charge-currency amounts. */
  cartToChargeRate: number;
  /** Multiply charge-currency amounts by this to get ledger-currency amounts. */
  chargeToLedgerRate: number;
  paymentCurrencies: string[];
};

function normalizeCurrency(code: string): string {
  return code.trim().toUpperCase();
}

export function paymentCurrenciesForMarket(params: {
  marketId: string;
  marketCode?: string | null;
  dbPaymentCurrencies?: string[] | null;
}): string[] {
  const fromDb = (params.dbPaymentCurrencies ?? [])
    .map(normalizeCurrency)
    .filter((c) => c.length === 3);
  if (fromDb.length > 0) return [...new Set(fromDb)];
  const code =
    (params.marketCode as MarketCode | null | undefined) ?? getMarketCodeById(params.marketId);
  if (code && code in MARKET_PAYMENT_CURRENCIES) {
    return [...MARKET_PAYMENT_CURRENCIES[code]];
  }
  return [];
}

export async function resolveCheckoutCurrencyPlan(params: {
  marketId: string;
  marketCode: string;
  marketDefaultCurrency: string;
  dbPaymentCurrencies?: string[] | null;
  cartCurrency: string;
  requestedPaymentCurrency?: string | null;
}): Promise<CheckoutCurrencyPlan> {
  const cartCurrency = normalizeCurrency(params.cartCurrency);
  const ledgerCurrency = normalizeCurrency(params.marketDefaultCurrency);
  const paymentCurrencies = paymentCurrenciesForMarket({
    marketId: params.marketId,
    marketCode: params.marketCode,
    dbPaymentCurrencies: params.dbPaymentCurrencies,
  });
  const allowed =
    paymentCurrencies.length > 0 ? paymentCurrencies : [cartCurrency || ledgerCurrency];

  const requested = params.requestedPaymentCurrency
    ? normalizeCurrency(params.requestedPaymentCurrency)
    : null;
  let chargeCurrency = requested && allowed.includes(requested) ? requested : null;
  if (!chargeCurrency) {
    chargeCurrency = allowed.includes(ledgerCurrency)
      ? ledgerCurrency
      : allowed.includes(cartCurrency)
        ? cartCurrency
        : allowed[0]!;
  }

  let cartToChargeRate = 1;
  if (cartCurrency !== chargeCurrency) {
    const rate = await getLatestFxRate(cartCurrency, chargeCurrency);
    if (rate == null) {
      throw new CheckoutCurrencyError(
        "FX_RATE_MISSING",
        `No FX rate for ${cartCurrency} → ${chargeCurrency}. Ask admin to set it.`,
      );
    }
    cartToChargeRate = rate;
  }

  let chargeToLedgerRate = 1;
  if (chargeCurrency !== ledgerCurrency) {
    const rate = await getLatestFxRate(chargeCurrency, ledgerCurrency);
    if (rate == null) {
      throw new CheckoutCurrencyError(
        "FX_RATE_MISSING",
        `No FX rate for ${chargeCurrency} → ${ledgerCurrency}. Ask admin to set it.`,
      );
    }
    chargeToLedgerRate = rate;
  }

  return {
    cartCurrency,
    chargeCurrency,
    ledgerCurrency,
    cartToChargeRate,
    chargeToLedgerRate,
    paymentCurrencies: allowed,
  };
}

export function convertMoneyString(amount: string | number, rate: number, decimals = 2): string {
  const n = typeof amount === "number" ? amount : Number.parseFloat(amount);
  if (!Number.isFinite(n)) return (0).toFixed(decimals);
  return (Math.round(n * rate * 10 ** decimals) / 10 ** decimals).toFixed(decimals);
}

export async function previewConvertAmount(params: {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
}): Promise<{ rate: number; converted: number } | null> {
  return convertAmount(params);
}
