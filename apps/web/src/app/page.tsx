import { listPublicProducts, listPublicStores, listMarketBanners } from "@mlm/domain";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import HomePageContent from "@/components/home/HomePageContent";
import GuestDeliveryPrompt from "@/components/catalog/GuestDeliveryPrompt";
import {
  getCatalogDeliveryPromptState,
  resolveRequestCatalogDelivery,
} from "@/lib/catalog-delivery-context";
import { defaultCountryForMarket } from "@/lib/guest-delivery-cookie";
import { getAppLocale } from "@/lib/ui-locale";
import { getServerSession } from "@/lib/server-session";
import { getActiveMarket } from "@/lib/market-server";
import { getBrandName } from "@/lib/brand";

export default async function Home() {
  const session = await getServerSession();
  const locale = await getAppLocale();
  const dict = locale === "ar" ? ar : en;
  const appName = getBrandName(locale);

  const market = await getActiveMarket();
  const [{ needsPrompt, delivery }, deliveryContext] = await Promise.all([
    getCatalogDeliveryPromptState(market.code),
    resolveRequestCatalogDelivery({ marketCode: market.code }),
  ]);

  const [productsResult, storesResult, banners] = await Promise.all([
    listPublicProducts({ limit: 8, locale, marketId: market.id, delivery: deliveryContext }),
    listPublicStores({ page: 1, pageSize: 6, marketId: market.id }),
    listMarketBanners({ marketId: market.id, locale, limit: 3 }),
  ]);
  const products = productsResult ?? [];
  const stores = storesResult.items ?? [];

  return (
    <>
      {!session ? (
        <div className="mx-auto w-full max-w-[1600px] px-3 pt-6 sm:px-6">
          <GuestDeliveryPrompt
            locale={locale}
            ui={dict.guestDelivery}
            needsPrompt={needsPrompt}
            delivery={delivery}
            defaultCountryCode={defaultCountryForMarket(market.code)}
          />
        </div>
      ) : null}
      <HomePageContent
        locale={locale}
        ui={dict.homePage}
        catalogUi={dict.productCatalog}
        storesUi={dict.publicStores}
        products={products}
        stores={stores}
        banners={banners}
        isLoggedIn={Boolean(session)}
        appName={appName}
      />
    </>
  );
}
