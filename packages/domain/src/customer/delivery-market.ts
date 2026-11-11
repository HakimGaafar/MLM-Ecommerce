import type { CustomerShippingAddressDto } from "@mlm/shared";
import {
  getMarketCodeById,
  isShippingCountryAllowedForMarket,
  resolveDeliveryMarketForCountry,
  type MarketCode,
} from "@mlm/shared";
import { prisma } from "@mlm/db";
import { CheckoutError } from "./checkout.service";

export function resolveHomeMarketCodeForCountry(countryCode: string): MarketCode {
  return resolveDeliveryMarketForCountry(countryCode);
}

export function countryCodeMatchesMarket(
  countryCode: string,
  marketCode: MarketCode,
  marketGeoCountryCodes?: readonly string[],
): boolean {
  const cc = countryCode.trim().toUpperCase();
  if (cc.length !== 2) return false;
  return isShippingCountryAllowedForMarket(cc, marketCode, marketGeoCountryCodes);
}

export type MarketShippingAddressPick = {
  selectedAddressId: string | null;
  shippingCountryCode: string | null;
  deliveryMismatchMarketCode: MarketCode | null;
};

type AddressRow = Pick<CustomerShippingAddressDto, "id" | "countryCode" | "isDefault">;

/**
 * Picks the delivery address for checkout on the active marketplace.
 * Pass `marketGeoCountryCodes` from the active market DB row for wizard markets.
 */
export function pickShippingAddressForMarket(params: {
  addresses: AddressRow[];
  activeMarketCode: MarketCode;
  marketGeoCountryCodes?: readonly string[];
  requestedAddressId?: string | null;
  profileCountryCode?: string | null;
}): MarketShippingAddressPick {
  const {
    addresses,
    activeMarketCode,
    marketGeoCountryCodes,
    requestedAddressId,
    profileCountryCode,
  } = params;
  const matching = addresses.filter((a) =>
    countryCodeMatchesMarket(a.countryCode, activeMarketCode, marketGeoCountryCodes),
  );

  if (requestedAddressId) {
    const picked = addresses.find((a) => a.id === requestedAddressId);
    if (picked) {
      const cc = picked.countryCode.trim().toUpperCase();
      if (countryCodeMatchesMarket(cc, activeMarketCode, marketGeoCountryCodes)) {
        return {
          selectedAddressId: picked.id,
          shippingCountryCode: cc,
          deliveryMismatchMarketCode: null,
        };
      }
      return {
        selectedAddressId: picked.id,
        shippingCountryCode: cc,
        deliveryMismatchMarketCode: resolveHomeMarketCodeForCountry(cc),
      };
    }
  }

  if (matching.length > 0) {
    const chosen = matching.find((a) => a.isDefault) ?? matching[0];
    return {
      selectedAddressId: chosen.id,
      shippingCountryCode: chosen.countryCode.trim().toUpperCase(),
      deliveryMismatchMarketCode: null,
    };
  }

  if (addresses.length > 0) {
    const fallback = addresses.find((a) => a.isDefault) ?? addresses[0];
    return {
      selectedAddressId: null,
      shippingCountryCode: null,
      deliveryMismatchMarketCode: resolveHomeMarketCodeForCountry(fallback.countryCode),
    };
  }

  if (profileCountryCode?.trim()) {
    const cc = profileCountryCode.trim().toUpperCase();
    if (countryCodeMatchesMarket(cc, activeMarketCode, marketGeoCountryCodes)) {
      return { selectedAddressId: null, shippingCountryCode: cc, deliveryMismatchMarketCode: null };
    }
    return {
      selectedAddressId: null,
      shippingCountryCode: cc,
      deliveryMismatchMarketCode: resolveHomeMarketCodeForCountry(cc),
    };
  }

  return { selectedAddressId: null, shippingCountryCode: null, deliveryMismatchMarketCode: null };
}

export async function assertShippingCountryMatchesMarket(params: {
  countryCode: string | null | undefined;
  marketId: string;
}): Promise<void> {
  const market = await prisma.market.findUnique({
    where: { id: params.marketId },
    select: { code: true, geoCountryCodes: true },
  });
  if (!market) {
    // Seed id fallback for pre-migrate / tests
    const activeCode = getMarketCodeById(params.marketId);
    if (!activeCode) return;
    const cc = params.countryCode?.trim().toUpperCase();
    if (!cc || cc.length !== 2) return;
    if (!isShippingCountryAllowedForMarket(cc, activeCode)) {
      const homeMarketCode = resolveHomeMarketCodeForCountry(cc);
      throw new CheckoutError(
        "DELIVERY_MARKET_MISMATCH",
        `Delivery to ${cc} must be completed on the ${homeMarketCode} storefront.`,
      );
    }
    return;
  }

  const cc = params.countryCode?.trim().toUpperCase();
  if (!cc || cc.length !== 2) return;

  if (!isShippingCountryAllowedForMarket(cc, market.code, market.geoCountryCodes)) {
    const homeMarketCode = resolveHomeMarketCodeForCountry(cc);
    throw new CheckoutError(
      "DELIVERY_MARKET_MISMATCH",
      `Delivery to ${cc} must be completed on the ${homeMarketCode} storefront.`,
    );
  }
}
