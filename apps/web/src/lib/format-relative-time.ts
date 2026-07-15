type Locale = "en" | "ar";

function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US").format(value);
}

function arabicUnit(value: number, singular: string, plural2to10: string): string {
  if (value === 1) return singular;
  if (value >= 2 && value <= 10) return plural2to10;
  return singular;
}

/**
 * Localized relative time from now, e.g.:
 * - en: "16 minutes ago"
 * - ar: "منذ 16 دقيقة"
 */
export function formatRelativeTimeFromNow(iso: string | Date, locale: Locale): string {
  const target = typeof iso === "string" ? new Date(iso) : iso;
  const diffMs = Date.now() - target.getTime();
  const safeMs = Number.isFinite(diffMs) ? Math.max(0, diffMs) : 0;

  const minutes = Math.max(1, Math.floor(safeMs / 60000));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (locale === "ar") {
    if (days >= 1) {
      const n = formatNumber(days, locale);
      return `منذ ${n} ${arabicUnit(days, "يوم", "أيام")}`;
    }
    if (hours >= 1) {
      const n = formatNumber(hours, locale);
      return `منذ ${n} ${arabicUnit(hours, "ساعة", "ساعات")}`;
    }
    const n = formatNumber(minutes, locale);
    return `منذ ${n} ${arabicUnit(minutes, "دقيقة", "دقائق")}`;
  }

  if (days >= 1) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
}

