import Link from "next/link";
import { redirect } from "next/navigation";
import type { MarketCode } from "@mlm/shared";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { getActiveMarket, listMarketsForPicker } from "@/lib/market-server";
import { userHasSuperAdminRole } from "@/lib/require-super-admin-session";
import { requirePageAuth } from "@/lib/require-page-auth";
import AdminCatalogCategoriesForm from "./AdminCatalogCategoriesForm";

export default async function AdminCatalogCategoriesPage() {
  const session = await requirePageAuth("ADMIN");
  if (!userHasSuperAdminRole(session.roles)) redirect("/admin");

  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminCatalogCategories;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const markets = await listMarketsForPicker();
  const activeMarket = await getActiveMarket();

  return (
    <main className="mx-auto w-full max-w-5xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <Link href="/admin/settings" className="text-sm font-medium text-link">
          {ui.backToSettings}
        </Link>
      </div>
      <AdminCatalogCategoriesForm
        locale={locale}
        ui={ui}
        markets={markets.map((m) => ({
          code: m.code as MarketCode,
          label: locale === "ar" ? m.nameAr : m.nameEn,
        }))}
        initialMarketCode={activeMarket.code}
      />
    </main>
  );
}
