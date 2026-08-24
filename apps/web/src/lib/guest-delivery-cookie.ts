import type { AddressCountryCode } from "@mlm/shared";

function normalizeDeliveryCity(city: string): string {
  return city.trim().replace(/\s+/g, " ");
}

export const GUEST_DELIVERY_COOKIE = "mlm_guest_delivery";
export const GUEST_DELIVERY_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type GuestDeliveryCookieValue = {
  countryCode: AddressCountryCode;
  city: string;
};

export function parseGuestDeliveryCookie(raw: string | undefined | null): GuestDeliveryCookieValue | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as { countryCode?: string; city?: string };
    const countryCode = parsed.countryCode?.trim().toUpperCase();
    const city = parsed.city?.trim();
    if (!countryCode || countryCode.length !== 2 || !city) return null;
    if (countryCode !== "SA" && countryCode !== "OM" && countryCode !== "EG") return null;
    return {
      countryCode: countryCode as AddressCountryCode,
      city: normalizeDeliveryCity(city),
    };
  } catch {
    return null;
  }
}

export function serializeGuestDeliveryCookie(value: GuestDeliveryCookieValue): string {
  return JSON.stringify({
    countryCode: value.countryCode,
    city: normalizeDeliveryCity(value.city),
  });
}

/** Default country for a market storefront. */
export function defaultCountryForMarket(marketCode: string): AddressCountryCode {
  if (marketCode === "OM") return "OM";
  if (marketCode === "EG") return "EG";
  return "SA";
}
