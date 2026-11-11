import {
  CARD_GATEWAY_IDS,
  gatewaySupportsCurrency,
  type CardGatewayId,
} from "@mlm/shared";
import {
  isStripeExplicitlyEnabled,
  isTapConfigured,
  isTapExplicitlyEnabled,
  listInstalledPaymentGateways,
} from "../payments/payment-config";

export type CurrencyGatewayCoverage = {
  currency: string;
  supportedBy: CardGatewayId[];
  covered: boolean;
};

export type PaymentCurrencyPublishCheck = {
  currencies: string[];
  matrix: CurrencyGatewayCoverage[];
  uncovered: string[];
  canPublish: boolean;
  installedGateways: CardGatewayId[];
  configuredGateways: CardGatewayId[];
  warnings: string[];
};

function configuredCardGateways(): CardGatewayId[] {
  const installed = listInstalledPaymentGateways().filter((g): g is CardGatewayId =>
    (CARD_GATEWAY_IDS as readonly string[]).includes(g),
  );
  return installed.filter((g) => {
    if (g === "tap") return isTapConfigured();
    if (g === "stripe") return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
    return false;
  });
}

/**
 * Draft may keep unsupported currencies (warn). Publish requires every payment
 * currency to be covered by at least one installed+configured gateway.
 */
export function checkPaymentCurrenciesForPublish(
  currencies: string[],
): PaymentCurrencyPublishCheck {
  const normalized = [...new Set(currencies.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  const installed = listInstalledPaymentGateways().filter((g): g is CardGatewayId =>
    (CARD_GATEWAY_IDS as readonly string[]).includes(g),
  );
  const configured = configuredCardGateways();
  // Prefer configured gateways for coverage; fall back to installed list for matrix display.
  const coverageGateways = configured.length > 0 ? configured : installed;

  const matrix: CurrencyGatewayCoverage[] = normalized.map((currency) => {
    const supportedBy = coverageGateways.filter((g) => gatewaySupportsCurrency(g, currency));
    return { currency, supportedBy, covered: supportedBy.length > 0 };
  });

  const uncovered = matrix.filter((row) => !row.covered).map((row) => row.currency);
  const warnings: string[] = [];
  if (configured.length === 0) {
    warnings.push("NO_GATEWAY_CONFIGURED");
  }
  if (!isTapExplicitlyEnabled() && !isStripeExplicitlyEnabled() && configured.length > 0) {
    warnings.push("ACTIVE_GATEWAY_MISMATCH");
  }
  for (const row of matrix) {
    if (!row.covered) warnings.push(`UNSUPPORTED_CURRENCY:${row.currency}`);
  }

  return {
    currencies: normalized,
    matrix,
    uncovered,
    canPublish: uncovered.length === 0 && configured.length > 0,
    installedGateways: installed,
    configuredGateways: configured,
    warnings,
  };
}
