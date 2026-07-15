export type AppLocale = "en" | "ar";

export function parseAppLocale(value: string | null | undefined): AppLocale | null {
  return value === "ar" || value === "en" ? value : null;
}

/** Explicit locale on API calls — avoids cookie race when switching language. */
export function catalogCategoriesUrl(locale: AppLocale): string {
  return `/api/v1/catalog/categories?locale=${locale}`;
}
