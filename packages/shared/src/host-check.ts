/** Public path the platform serves for live host/DNS HTTP verification. */
export const MARKET_HOST_CHECK_PATH = "/.well-known/vandsoq-host-check";

/** Env var holding the shared secret returned by the host-check endpoint. */
export const MARKET_HOST_CHECK_TOKEN_ENV = "MARKET_HOST_CHECK_TOKEN";

export function getMarketHostCheckToken(): string | null {
  const token = process.env[MARKET_HOST_CHECK_TOKEN_ENV]?.trim();
  return token || null;
}
