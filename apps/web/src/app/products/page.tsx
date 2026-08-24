import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import ProductsCatalog from "@/components/catalog/ProductsCatalog";
import GuestDeliveryPrompt from "@/components/catalog/GuestDeliveryPrompt";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { getCatalogDeliveryPromptState } from "@/lib/catalog-delivery-context";
import { defaultCountryForMarket } from "@/lib/guest-delivery-cookie";
import { getAppLocale } from "@/lib/ui-locale";
import { getServerSession } from "@/lib/server-session";
import { getActiveMarket } from "@/lib/market-server";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  const { categoryId } = await searchParams;
  const locale = await getAppLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.productCatalog;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const session = await getServerSession();
  const market = await getActiveMarket();
  const { needsPrompt, delivery } = await getCatalogDeliveryPromptState(market.code);

  return (
    <PageShell dir={direction}>
      <PageHeader title={ui.title} subtitle={ui.subtitle} />
      {!session ? (
        <GuestDeliveryPrompt
          locale={locale}
          ui={dict.guestDelivery}
          needsPrompt={needsPrompt}
          delivery={delivery}
          defaultCountryCode={defaultCountryForMarket(market.code)}
        />
      ) : null}
      <ProductsCatalog locale={locale} ui={ui} initialCategoryId={categoryId ?? null} />
    </PageShell>
  );
}
