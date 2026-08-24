import Link from "next/link";
import { redirect } from "next/navigation";
import type { MarketCode } from "@mlm/shared";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { getActiveMarket, listMarketsForPicker } from "@/lib/market-server";
import { userHasSuperAdminRole } from "@/lib/require-super-admin-session";
import { requirePageAuth } from "@/lib/require-page-auth";
import AdminPlatformConfigAuditList from "./AdminPlatformConfigAuditList";

export default async function AdminPlatformConfigAuditPage() {
  const session = await requirePageAuth("ADMIN");
  if (!userHasSuperAdminRole(session.roles)) {
    redirect("/admin");
  }

  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminPlatformConfigAudit;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const markets = await listMarketsForPicker();
  const activeMarket = await getActiveMarket();

  return (
    <main className="mx-auto w-full max-w-6xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-link">
          {ui.backToDashboard}
        </Link>
      </div>
      <AdminPlatformConfigAuditList
        locale={locale}
        ui={ui}
        markets={markets.map((market) => ({
          code: market.code,
          label: locale === "ar" ? market.nameAr : market.nameEn,
        }))}
        initialMarketCode={activeMarket.code as MarketCode}
      />
    </main>
  );
}
