/** Public path the platform serves for live host/DNS HTTP verification. */
export const MARKET_HOST_CHECK_PATH = "/.well-known/vandsoq-host-check";

/** Env var holding the shared secret returned by the host-check endpoint. */
export const MARKET_HOST_CHECK_TOKEN_ENV = "MARKET_HOST_CHECK_TOKEN";

/** Optional previous token accepted by Verify DNS during rotate. */
export const MARKET_HOST_CHECK_TOKEN_PREV_ENV = "MARKET_HOST_CHECK_TOKEN_PREV";

export function getMarketHostCheckToken(): string | null {
  const token = process.env[MARKET_HOST_CHECK_TOKEN_ENV]?.trim();
  return token || null;
}

/** Current + previous tokens the verifier may accept (deduped). */
export function getMarketHostCheckTokens(): string[] {
  const current = getMarketHostCheckToken();
  const prev = process.env[MARKET_HOST_CHECK_TOKEN_PREV_ENV]?.trim() || null;
  return [...new Set([current, prev].filter((t): t is string => Boolean(t)))];
}
