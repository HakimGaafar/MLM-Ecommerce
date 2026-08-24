import Link from "next/link";
import type { MarketCode } from "@mlm/shared";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { getActiveMarket, listMarketsForPicker } from "@/lib/market-server";
import { requirePageAuth } from "@/lib/require-page-auth";
import AdminShippingRatesForm from "./AdminShippingRatesForm";

export default async function AdminShippingRatesPage() {
  await requirePageAuth("ADMIN");

  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminShippingRates;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const markets = await listMarketsForPicker();
  const activeMarket = await getActiveMarket();
  const marketOptions = markets.map((market) => ({
    code: market.code as MarketCode,
    label: locale === "ar" ? market.nameAr : market.nameEn,
    currency: market.defaultCurrency,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <Link href="/admin/shipping/requests" className="text-sm font-medium text-link">
          {ui.shippingRequestsLink}
        </Link>
      </div>
      <AdminShippingRatesForm
        locale={locale}
        ui={ui}
        markets={marketOptions}
        initialMarketCode={activeMarket.code}
      />
    </main>
  );
}
