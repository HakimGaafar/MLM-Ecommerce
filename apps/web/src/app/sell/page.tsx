import { redirect } from "next/navigation";
import SellWizard from "@/app/sell/SellWizard";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { getAppLocale } from "@/lib/ui-locale";
import { getActiveMarket } from "@/lib/market-server";
import { getServerSession } from "@/lib/server-session";
import { firstAllowedVendorHrefForUser } from "@/lib/vendor-access";
import { resolveVendorAccessForUser } from "@mlm/domain";

export default async function SellPage() {
  const locale = await getAppLocale();
  const ui = locale === "ar" ? ar.sellOnboarding : en.sellOnboarding;
  const direction = locale === "ar" ? "rtl" : "ltr";

  const session = await getServerSession();
  if (session) {
    const market = await getActiveMarket();
    const access = await resolveVendorAccessForUser(session.sub, market.id);
    if (access) {
      const href = (await firstAllowedVendorHrefForUser(session.sub, market.id)) ?? "/vendor/products";
      redirect(href);
    }
  }

  const mode = session ? "loggedIn" : "guest";

  return (
    <PageShell dir={direction} maxWidth="3xl">
      <PageHeader
        title={mode === "loggedIn" ? ui.loggedInTitle : ui.title}
        subtitle={mode === "loggedIn" ? ui.loggedInSubtitle : ui.subtitle}
      />
      <SellWizard locale={locale} ui={ui} mode={mode} />
    </PageShell>
  );
}
