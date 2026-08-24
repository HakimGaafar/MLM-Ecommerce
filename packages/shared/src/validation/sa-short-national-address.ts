/** Saudi short national address: 4 letters + 4 digits (e.g. AREB1343). */
export const SA_SHORT_NATIONAL_ADDRESS_REGEX = /^[A-Za-z]{4}\d{4}$/;

export function normalizeSaShortNationalAddress(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidSaShortNationalAddress(value: string): boolean {
  const normalized = normalizeSaShortNationalAddress(value);
  return normalized.length === 0 || SA_SHORT_NATIONAL_ADDRESS_REGEX.test(normalized);
}
