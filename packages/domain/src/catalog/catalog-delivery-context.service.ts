import type { MarketCode } from "@mlm/shared";
import { listAllCustomerShippingAddressesForCheckout } from "../customer/customer-addresses.service";
import { pickShippingAddressForMarket } from "../customer/delivery-market";
import { normalizeDeliveryCity } from "../shipping/vendor-delivery-coverage.service";

export type CatalogDeliveryContext = {
  countryCode: string;
  city: string;
};

export async function resolveCatalogDeliveryContext(params: {
  userId?: string | null;
  activeMarketCode: MarketCode;
  deliveryCountryCode?: string | null;
  deliveryCity?: string | null;
}): Promise<CatalogDeliveryContext | null> {
  const explicitCountry = params.deliveryCountryCode?.trim().toUpperCase();
  const explicitCity = params.deliveryCity?.trim();
  if (explicitCountry && explicitCountry.length === 2 && explicitCity) {
    return {
      countryCode: explicitCountry,
      city: normalizeDeliveryCity(explicitCity),
    };
  }

  if (!params.userId) return null;

  const addresses = await listAllCustomerShippingAddressesForCheckout(params.userId);
  const pick = pickShippingAddressForMarket({
    addresses,
    activeMarketCode: params.activeMarketCode,
  });
  if (!pick.selectedAddressId) return null;

  const addr = addresses.find((row) => row.id === pick.selectedAddressId);
  if (!addr?.city?.trim()) return null;

  return {
    countryCode: addr.countryCode.trim().toUpperCase(),
    city: normalizeDeliveryCity(addr.city),
  };
}
