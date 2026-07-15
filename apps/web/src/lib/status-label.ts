/** Maps API enum codes (e.g. PENDING) to localized display labels. */
export function statusLabel(code: string, labels: Record<string, string>): string {
  return labels[code] ?? code;
}
