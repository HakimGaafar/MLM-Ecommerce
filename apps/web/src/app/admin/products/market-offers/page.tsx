import Link from "next/link";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { requirePageAuth } from "@/lib/require-page-auth";
import AdminMarketOffersList from "./AdminMarketOffersList";

export default async function AdminMarketOffersPage() {
  await requirePageAuth("ADMIN");
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminMarketOffers;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-6xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Link href="/admin/products/pending" className="text-sm font-medium text-link">
            {ui.linkProductApprovals}
          </Link>
          <Link href="/admin" className="text-sm font-medium text-link">
            {ui.backToDashboard}
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <AdminMarketOffersList locale={locale} ui={ui.list} />
      </div>
    </main>
  );
}
