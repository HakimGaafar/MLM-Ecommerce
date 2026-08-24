import { cookies } from "next/headers";
import { resolveCatalogDeliveryContext, type CatalogDeliveryContext } from "@mlm/domain";
import type { MarketCode } from "@mlm/shared";
import {
  GUEST_DELIVERY_COOKIE,
  parseGuestDeliveryCookie,
} from "@/lib/guest-delivery-cookie";
import { getServerSession } from "@/lib/server-session";

export type { CatalogDeliveryContext };

export async function resolveRequestCatalogDelivery(params: {
  marketCode: MarketCode;
  deliveryCountryCode?: string | null;
  deliveryCity?: string | null;
}): Promise<CatalogDeliveryContext | null> {
  const session = await getServerSession();
  const cookieStore = await cookies();
  const guest = parseGuestDeliveryCookie(cookieStore.get(GUEST_DELIVERY_COOKIE)?.value);

  return resolveCatalogDeliveryContext({
    userId: session?.sub,
    activeMarketCode: params.marketCode,
    deliveryCountryCode: params.deliveryCountryCode ?? guest?.countryCode,
    deliveryCity: params.deliveryCity ?? guest?.city,
  });
}

export async function getCatalogDeliveryPromptState(marketCode: MarketCode): Promise<{
  needsPrompt: boolean;
  delivery: CatalogDeliveryContext | null;
}> {
  const delivery = await resolveRequestCatalogDelivery({ marketCode });
  return {
    needsPrompt: !delivery,
    delivery,
  };
}
