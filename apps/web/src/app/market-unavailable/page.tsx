import Link from "next/link";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getAppLocale } from "@/lib/ui-locale";
import { listMarketsForPicker } from "@/lib/market-server";
import { getMarketDefinition, isMarketCode, type MarketCode } from "@mlm/shared";

type PageProps = {
  searchParams: Promise<{ market?: string }>;
};

export default async function MarketUnavailablePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const locale = await getAppLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.marketUnavailable;
  const direction = locale === "ar" ? "rtl" : "ltr";

  const codeParam = params.market?.trim().toUpperCase();
  let marketName = ui.unknownMarket;
  if (codeParam && isMarketCode(codeParam)) {
    const def = getMarketDefinition(codeParam);
    marketName = locale === "ar" ? def.nameAr : def.nameEn;
  }

  const activeMarkets = await listMarketsForPicker();
  const alternatives = activeMarkets
    .filter((m) => m.code !== codeParam)
    .slice(0, 3)
    .map((m) => ({
      code: m.code,
      href: `/?market=${m.code}`,
      label: locale === "ar" ? m.nameAr : m.nameEn,
    }));

  return (
    <main
      className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center p-8 text-center animate-page-enter"
      dir={direction}
    >
      <h1 className="text-2xl font-semibold">{ui.title}</h1>
      <p className="mt-3 text-sm text-[var(--muted)]">
        {ui.description.replace("{market}", marketName)}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/market" className="btn-primary btn-press px-5 py-2.5">
          {ui.chooseMarket}
        </Link>
        <Link href="/?market=SA" className="btn-secondary btn-press px-5 py-2.5">
          {ui.goToSaudi}
        </Link>
      </div>
      {alternatives.length > 0 ? (
        <p className="mt-6 text-xs text-[var(--muted)]">
          {ui.alternatives}{" "}
          {alternatives.map((alt, index) => (
            <span key={alt.code}>
              {index > 0 ? " · " : ""}
              <Link href={alt.href} className="text-link">
                {alt.label}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
    </main>
  );
}
