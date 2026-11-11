import { ADD_MARKET_COUNTRY_CATALOG, getAddMarketCountryOption } from "@mlm/shared";

type ContactMarketCopy = { name: string; locationText: string };
type PickerMarketCopy = { description: string };

/**
 * Resolve storefront market label from i18n, then catalog, then code.
 * Covers seed markets + Add Market catalog countries.
 */
export function resolveMarketSwitcherLabel(
  code: string,
  labels: Record<string, string> | undefined,
  locale: "en" | "ar",
  dbName?: { nameEn?: string; nameAr?: string } | null,
): string {
  const fromI18n = labels?.[code]?.trim();
  if (fromI18n) return fromI18n;
  if (locale === "ar" && dbName?.nameAr?.trim()) return dbName.nameAr.trim();
  if (locale === "en" && dbName?.nameEn?.trim()) return dbName.nameEn.trim();
  const catalog = getAddMarketCountryOption(code);
  if (catalog) return locale === "ar" ? catalog.nameAr : catalog.nameEn;
  return code;
}

export function resolveMarketPickerDescription(
  code: string,
  currency: string,
  pickerMarkets: Record<string, PickerMarketCopy> | undefined,
  locale: "en" | "ar",
): string {
  const fromI18n = pickerMarkets?.[code]?.description?.trim();
  if (fromI18n) return fromI18n;
  const catalog = getAddMarketCountryOption(code);
  const name = catalog
    ? locale === "ar"
      ? catalog.nameAr
      : catalog.nameEn
    : code;
  const cur = (catalog?.defaultCurrency || currency || "").toUpperCase();
  if (locale === "ar") {
    return cur ? `التسوق في ${name} — الأسعار بـ ${cur}` : `التسوق في ${name}`;
  }
  return cur ? `Shop in ${name} — prices in ${cur}` : `Shop in ${name}`;
}

export function resolveContactMarketCopy(
  code: string,
  contactMarkets: Record<string, ContactMarketCopy> | undefined,
  locale: "en" | "ar",
  dbName?: { nameEn?: string; nameAr?: string } | null,
): ContactMarketCopy {
  const fromI18n = contactMarkets?.[code];
  if (fromI18n?.name?.trim()) {
    return {
      name: fromI18n.name,
      locationText:
        fromI18n.locationText?.trim() ||
        defaultLocationText(fromI18n.name, locale),
    };
  }
  const name = resolveMarketSwitcherLabel(code, undefined, locale, dbName);
  return {
    name,
    locationText: defaultLocationText(name, locale),
  };
}

function defaultLocationText(name: string, locale: "en" | "ar"): string {
  return locale === "ar"
    ? `بيانات الدعم والمكتب لسوق ${name}.`
    : `Support and office details for the ${name} market.`;
}

/** All catalog market codes that should have explicit i18n rows. */
export function listAddMarketI18nCodes(): string[] {
  return ADD_MARKET_COUNTRY_CATALOG.map((row) => row.marketCode);
}
