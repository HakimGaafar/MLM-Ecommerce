/**
 * Countries an admin may register via Add Market wizard.
 * Existing markets (by code or geo claim) are filtered out at runtime.
 */
export type AddMarketCountryOption = {
  countryCode: string;
  nameEn: string;
  nameAr: string;
  defaultCurrency: string;
  /** Suggested market code (usually = countryCode). */
  marketCode: string;
  subdomain: string;
};

/** Curated MENA / common expansion set — not already in SA/OM/EG/GLOBAL seed. */
export const ADD_MARKET_COUNTRY_CATALOG: readonly AddMarketCountryOption[] = [
  { countryCode: "AE", nameEn: "United Arab Emirates", nameAr: "الإمارات", defaultCurrency: "AED", marketCode: "AE", subdomain: "uae" },
  { countryCode: "BH", nameEn: "Bahrain", nameAr: "البحرين", defaultCurrency: "BHD", marketCode: "BH", subdomain: "bahrain" },
  { countryCode: "KW", nameEn: "Kuwait", nameAr: "الكويت", defaultCurrency: "KWD", marketCode: "KW", subdomain: "kuwait" },
  { countryCode: "QA", nameEn: "Qatar", nameAr: "قطر", defaultCurrency: "QAR", marketCode: "QA", subdomain: "qatar" },
  { countryCode: "JO", nameEn: "Jordan", nameAr: "الأردن", defaultCurrency: "JOD", marketCode: "JO", subdomain: "jordan" },
  { countryCode: "IQ", nameEn: "Iraq", nameAr: "العراق", defaultCurrency: "IQD", marketCode: "IQ", subdomain: "iraq" },
  { countryCode: "LB", nameEn: "Lebanon", nameAr: "لبنان", defaultCurrency: "LBP", marketCode: "LB", subdomain: "lebanon" },
  { countryCode: "YE", nameEn: "Yemen", nameAr: "اليمن", defaultCurrency: "YER", marketCode: "YE", subdomain: "yemen" },
  { countryCode: "MA", nameEn: "Morocco", nameAr: "المغرب", defaultCurrency: "MAD", marketCode: "MA", subdomain: "morocco" },
  { countryCode: "TN", nameEn: "Tunisia", nameAr: "تونس", defaultCurrency: "TND", marketCode: "TN", subdomain: "tunisia" },
  { countryCode: "DZ", nameEn: "Algeria", nameAr: "الجزائر", defaultCurrency: "DZD", marketCode: "DZ", subdomain: "algeria" },
  { countryCode: "LY", nameEn: "Libya", nameAr: "ليبيا", defaultCurrency: "LYD", marketCode: "LY", subdomain: "libya" },
  { countryCode: "SD", nameEn: "Sudan", nameAr: "السودان", defaultCurrency: "SDG", marketCode: "SD", subdomain: "sudan" },
  { countryCode: "TR", nameEn: "Türkiye", nameAr: "تركيا", defaultCurrency: "TRY", marketCode: "TR", subdomain: "turkey" },
  { countryCode: "GB", nameEn: "United Kingdom", nameAr: "المملكة المتحدة", defaultCurrency: "GBP", marketCode: "GB", subdomain: "uk" },
  { countryCode: "US", nameEn: "United States", nameAr: "الولايات المتحدة", defaultCurrency: "USD", marketCode: "US", subdomain: "us" },
  { countryCode: "DE", nameEn: "Germany", nameAr: "ألمانيا", defaultCurrency: "EUR", marketCode: "DE", subdomain: "germany" },
  { countryCode: "FR", nameEn: "France", nameAr: "فرنسا", defaultCurrency: "EUR", marketCode: "FR", subdomain: "france" },
  { countryCode: "IN", nameEn: "India", nameAr: "الهند", defaultCurrency: "INR", marketCode: "IN", subdomain: "india" },
  { countryCode: "PK", nameEn: "Pakistan", nameAr: "باكستان", defaultCurrency: "PKR", marketCode: "PK", subdomain: "pakistan" },
] as const;

/** World currencies offered in the wizard (multi-select; already-picked removed in UI). */
export const ADD_MARKET_CURRENCY_OPTIONS = [
  "AED",
  "BHD",
  "EGP",
  "EUR",
  "GBP",
  "INR",
  "IQD",
  "JOD",
  "KWD",
  "LBP",
  "LYD",
  "MAD",
  "OMR",
  "PKR",
  "QAR",
  "SAR",
  "SDG",
  "TND",
  "TRY",
  "USD",
  "YER",
] as const;

export type AddMarketCurrencyCode = (typeof ADD_MARKET_CURRENCY_OPTIONS)[number];

export function getAddMarketCountryOption(countryCode: string): AddMarketCountryOption | null {
  const cc = countryCode.trim().toUpperCase();
  return ADD_MARKET_COUNTRY_CATALOG.find((row) => row.countryCode === cc) ?? null;
}

/** Valid market code format for DB-driven markets (not limited to SA/OM/EG/GLOBAL). */
export function isMarketCodeFormat(value: string): boolean {
  return /^[A-Z][A-Z0-9]{1,15}$/.test(value.trim().toUpperCase());
}
