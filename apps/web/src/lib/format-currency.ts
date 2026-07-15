export type AppLocale = "en" | "ar";

const LABELS_AR: Record<string, string> = {
  SAR: "ريال",
};

const LABELS_EN: Record<string, string> = {
  SAR: "SAR",
};

const AMOUNT_LOCALE: Record<AppLocale, string> = {
  en: "en-GB",
  ar: "ar-SA",
};

function parseAmount(amount: string | number): number {
  if (typeof amount === "number") return amount;
  const n = Number.parseFloat(amount.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
}

/** ISO currency code → display label for the active UI locale. */
export function formatCurrencyCode(code: string, locale: AppLocale): string {
  const key = code.trim().toUpperCase();
  const table = locale === "ar" ? LABELS_AR : LABELS_EN;
  return table[key] ?? code;
}

/** Locale-aware amount only, e.g. `0.50` (en) or `٠٫٥٠` (ar). */
export function formatAmount(amount: string | number, locale: AppLocale): string {
  const n = parseAmount(amount);
  if (!Number.isFinite(n)) return String(amount);
  return new Intl.NumberFormat(AMOUNT_LOCALE[locale], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Amount + localized currency label, e.g. `0.50 SAR` or `٠٫٥٠ ريال`. */
export function formatMoney(amount: string, currency: string, locale: AppLocale): string {
  return `${formatAmount(amount, locale)} ${formatCurrencyCode(currency, locale)}`;
}
