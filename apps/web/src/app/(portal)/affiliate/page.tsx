import { settlementWindowDays, week1BusinessRules, getPlatformConfig } from "@mlm/domain";
import Link from "next/link";
import { cookies } from "next/headers";
import AffiliateView from "@/app/customer/affiliate/AffiliateView";
import { ACTIVE_ROLE_COOKIE, resolveActiveRole } from "@/lib/active-role";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { getActiveMarket } from "@/lib/market-server";
import { getServerSession } from "@/lib/server-session";
export default async function AffiliatePage() {
  const session = await getServerSession();
  const cookieStore = await cookies();
  const role = resolveActiveRole(session?.roles ?? [], cookieStore.get(ACTIVE_ROLE_COOKIE)?.value);
  if (role !== "CUSTOMER") {
    return (
      <main className="mx-auto w-full max-w-4xl p-8 animate-page-enter">
        <h1 className="text-2xl font-semibold">Affiliate</h1>
        <p className="mt-3 text-[var(--muted)]">The affiliate program is for customer accounts.</p>
      </main>
    );
  }

  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = {
    ...dict.customerAffiliate,
    statusLabels: dict.ledgerStatus as Record<string, string>,
  };
  const direction = locale === "ar" ? "rtl" : "ltr";
  const market = await getActiveMarket();
  const platformConfig = await getPlatformConfig(market.id);
  const programRules = {
    poolPercent: Math.round(platformConfig.affiliatePoolRate * 1000) / 10,
    depth: week1BusinessRules.referralDepthMax,
    levelPercentsOfPool: platformConfig.affiliateLevelRates.map(
      (rate) => Math.round(rate * 1000) / 10,
    ),
    settlementDays: settlementWindowDays,
    currency: market.defaultCurrency,
  };
  return (
    <main className="mx-auto w-full max-w-5xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-link">
          {ui.backToDashboard}
        </Link>
      </div>

      <AffiliateView locale={locale} ui={ui} programRules={programRules} />
    </main>
  );
}
