import type { CustomerOrderHomeMarket } from "@mlm/domain";
import Link from "next/link";
import GoToMarketButton from "@/components/market/GoToMarketButton";
import { PageHeader, PageShell } from "@/components/ui/PageShell";

export type CustomerOrderAccessUi = {
  wrongMarketTitle: string;
  wrongMarketBody: string;
  notFoundTitle: string;
  notFoundBody: string;
  switchToMarket: string;
  backToOrders: string;
  switchError: string;
};

function marketLabel(homeMarket: CustomerOrderHomeMarket, locale: "en" | "ar") {
  return locale === "ar" ? homeMarket.marketNameAr : homeMarket.marketNameEn;
}

export function CustomerOrderWrongMarket({
  locale,
  homeMarket,
  returnTo,
  ui,
}: {
  locale: "en" | "ar";
  homeMarket: CustomerOrderHomeMarket;
  returnTo: string;
  ui: CustomerOrderAccessUi;
}) {
  const label = marketLabel(homeMarket, locale);

  return (
    <PageShell dir={locale === "ar" ? "rtl" : "ltr"} maxWidth="3xl">
      <PageHeader title={ui.wrongMarketTitle} />
      <section className="app-card p-8 text-center">
        <p className="text-sm text-[var(--muted)]">{ui.wrongMarketBody.replace("{market}", label)}</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <GoToMarketButton
            homeMarketCode={homeMarket.marketCode}
            returnTo={returnTo}
            label={ui.switchToMarket.replace("{market}", label)}
            switchError={ui.switchError}
          />
          <Link href="/orders" className="btn-secondary btn-press inline-flex">
            {ui.backToOrders}
          </Link>
        </div>
      </section>
    </PageShell>
  );
}

export function CustomerOrderNotFound({
  locale,
  ui,
}: {
  locale: "en" | "ar";
  ui: CustomerOrderAccessUi;
}) {
  return (
    <PageShell dir={locale === "ar" ? "rtl" : "ltr"} maxWidth="3xl">
      <PageHeader title={ui.notFoundTitle} />
      <section className="app-card p-8 text-center">
        <p className="text-sm text-[var(--muted)]">{ui.notFoundBody}</p>
        <Link href="/orders" className="btn-secondary btn-press mt-6 inline-flex">
          {ui.backToOrders}
        </Link>
      </section>
    </PageShell>
  );
}
