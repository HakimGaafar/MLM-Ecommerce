type Locale = "en" | "ar";

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function englishUnit(value: number, singular: string, plural: string): string {
  return value === 1 ? singular : plural;
}

function arabicUnit(value: number, singular: string, plural2to10: string): string {
  if (value === 1) return singular;
  if (value >= 2 && value <= 10) return plural2to10;
  return singular;
}

/** Waiting time in hours (admin fulfillment SLA tables). */
export function formatWaitHours(hours: number, locale: Locale): string {
  const valueText = formatValue(hours);
  if (locale === "ar") {
    const unit = arabicUnit(hours, "ساعة", "ساعات");
    return `${valueText} ${unit}`;
  }
  const unit = englishUnit(hours, "hour", "hours");
  return `${valueText} ${unit}`;
}

/** Generic duration parts for future use (seconds, minutes, hours). */
export function formatDurationUnit(
  amount: number,
  unit: "second" | "minute" | "hour",
  locale: Locale,
): string {
  const valueText = formatValue(amount);
  if (locale === "ar") {
    if (unit === "second") return `${valueText} ${arabicUnit(amount, "ثانية", "ثوان")}`;
    if (unit === "minute") return `${valueText} ${arabicUnit(amount, "دقيقة", "دقائق")}`;
    return `${valueText} ${arabicUnit(amount, "ساعة", "ساعات")}`;
  }
  if (unit === "second") return `${valueText} ${englishUnit(amount, "second", "seconds")}`;
  if (unit === "minute") return `${valueText} ${englishUnit(amount, "minute", "minutes")}`;
  return `${valueText} ${englishUnit(amount, "hour", "hours")}`;
}
