/** Set when the user explicitly picks or switches marketplace (picker or header switcher). */
export const MARKET_CONFIRMED_STORAGE_KEY = "mlm_market_confirmed";

export function markMarketConfirmed(): void {
  try {
    localStorage.setItem(MARKET_CONFIRMED_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isMarketConfirmed(): boolean {
  try {
    return localStorage.getItem(MARKET_CONFIRMED_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}
