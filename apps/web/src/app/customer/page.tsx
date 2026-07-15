import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import CustomerDashboardContent from "@/components/customer/CustomerDashboardContent";
import {  PageShell } from "@/components/ui/PageShell";
import { getCachedCustomerDashboardOverview } from "@/lib/customer-dashboard-cache";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { getServerSession } from "@/lib/server-session";
import { getActiveMarket } from "@/lib/market-server";

export default async function CustomerDashboardPage() {
  const session = await getServerSession();
  const locale = await getCustomerPreferredLocale();
  const ui = locale === "ar" ? ar.customerDashboard : en.customerDashboard;
  const catalogUi = locale === "ar" ? ar.productCatalog : en.productCatalog;
  const direction = locale === "ar" ? "rtl" : "ltr";

  const market = await getActiveMarket();
  const overview = await getCachedCustomerDashboardOverview(session!.sub, locale, market.id);

  return (
    <PageShell dir={direction} maxWidth="6xl">
      <CustomerDashboardContent locale={locale} overview={overview} ui={ui} catalogUi={catalogUi} />
    </PageShell>
  );
}
