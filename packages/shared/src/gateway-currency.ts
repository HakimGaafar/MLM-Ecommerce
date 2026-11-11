/** Installed card PSP ids used for currency publish checks. */
export const CARD_GATEWAY_IDS = ["tap", "stripe"] as const;
export type CardGatewayId = (typeof CARD_GATEWAY_IDS)[number];

/** Tap-supported settlement/charge currencies (common GCC + major). */
export const TAP_SUPPORTED_CURRENCIES = [
  "AED",
  "BHD",
  "EGP",
  "EUR",
  "GBP",
  "JOD",
  "KWD",
  "OMR",
  "QAR",
  "SAR",
  "USD",
] as const;

/** Stripe card currencies we accept for publish checks. */
export const STRIPE_SUPPORTED_CURRENCIES = [
  "AED",
  "EUR",
  "GBP",
  "SAR",
  "USD",
  "OMR",
  "EGP",
  "QAR",
  "BHD",
  "KWD",
] as const;

const GATEWAY_CURRENCY_SUPPORT: Record<CardGatewayId, readonly string[]> = {
  tap: TAP_SUPPORTED_CURRENCIES,
  stripe: STRIPE_SUPPORTED_CURRENCIES,
};

export function currenciesSupportedByGateway(gateway: CardGatewayId): readonly string[] {
  return GATEWAY_CURRENCY_SUPPORT[gateway];
}

export function gatewaySupportsCurrency(gateway: CardGatewayId, currency: string): boolean {
  const code = currency.trim().toUpperCase();
  return GATEWAY_CURRENCY_SUPPORT[gateway].includes(code);
}

/** True if at least one installed card gateway list includes this currency (UI selectable). */
export function isPaymentCurrencyGatewaySupported(currency: string): boolean {
  const code = currency.trim().toUpperCase();
  return CARD_GATEWAY_IDS.some((g) => gatewaySupportsCurrency(g, code));
}

/** Currencies from the add-market catalog that no card gateway supports (show greyed / locked). */
export function listUnsupportedAddMarketCurrencies(
  catalog: readonly string[],
): string[] {
  return catalog.filter((c) => !isPaymentCurrencyGatewaySupported(c));
}

export const MARKET_LIFECYCLE_STATUSES = ["DRAFT", "READY", "LIVE", "SUSPENDED"] as const;
export type MarketLifecycleStatus = (typeof MARKET_LIFECYCLE_STATUSES)[number];
