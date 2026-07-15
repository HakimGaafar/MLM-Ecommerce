import { listPublicProducts, listPublicStores, listMarketBanners } from "@mlm/domain";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import HomePageContent from "@/components/home/HomePageContent";
import { getAppLocale } from "@/lib/ui-locale";
import { getServerSession } from "@/lib/server-session";
import { getActiveMarket } from "@/lib/market-server";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "MLM Ecommerce";

export default async function Home() {
  const session = await getServerSession();
  const locale = await getAppLocale();
  const dict = locale === "ar" ? ar : en;

  const market = await getActiveMarket();

  const [productsResult, storesResult, banners] = await Promise.all([
    listPublicProducts({ limit: 8, locale, marketId: market.id }),
    listPublicStores({ page: 1, pageSize: 6, marketId: market.id }),
    listMarketBanners({ marketId: market.id, locale, limit: 3 }),
  ]);
  const products = productsResult ?? [];
  const stores = storesResult.items ?? [];

  return (
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
  );
}
