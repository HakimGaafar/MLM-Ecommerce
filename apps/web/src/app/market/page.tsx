import { Suspense } from "react";
import { redirect } from "next/navigation";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import MarketPickerView from "@/app/market/MarketPickerView";
import { getAppLocale } from "@/lib/ui-locale";
import { getSuggestedMarketCode, listMarketsForPicker } from "@/lib/market-server";
import { getServerSession } from "@/lib/server-session";
import { resolveDefaultVendorMarketCode } from "@mlm/domain";
import type { MarketCode } from "@mlm/shared";

type PageProps = {
  searchParams: Promise<{ returnTo?: string }>;
};

function safeReturnPath(value: string | undefined): string {
  const path = value?.trim() || "/";
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

export default async function MarketPickerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params.returnTo);
  const session = await getServerSession();

  if (session?.roles?.includes("ADMIN")) {
    redirect(returnTo);
  }

  if (session?.roles?.includes("VENDOR")) {
    const vendorMarket = await resolveDefaultVendorMarketCode(session.sub);
    if (vendorMarket) {
      redirect(
        `/api/v1/market/auto-resolve?returnTo=${encodeURIComponent(returnTo)}`,
      );
    }
  }

  const locale = await getAppLocale();
  const dict = locale === "ar" ? ar : en;
  const markets = await listMarketsForPicker();
  const suggestedCode = await getSuggestedMarketCode();

  const options = markets.map((m) => {
    const ui = dict.marketPicker.markets[m.code as MarketCode];
    return {
      code: m.code,
      name: locale === "ar" ? m.nameAr : m.nameEn,
      currency: m.defaultCurrency,
      description: ui?.description ?? "",
    };
  });

  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[var(--muted)]">…</div>}>
      <MarketPickerView
        locale={locale}
        ui={dict.marketPicker}
        options={options}
        suggestedCode={suggestedCode}
      />
    </Suspense>
  );
}
