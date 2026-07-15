import Link from "next/link";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import VendorPayoutView from "./VendorPayoutView";

export default async function VendorPayoutPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = {
    ...dict.vendorPayout,
    statusLabels: dict.ledgerStatus as Record<string, string>,
  };
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-4xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <Link href="/dashboard" className="text-sm text-link font-medium">
          {ui.backToDashboard}
        </Link>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link href="/vendor/kyc" className="text-sm text-link font-medium">
          {dict.kyc.vendorTitle} →
        </Link>
        <Link href="/vendor/operations" className="text-sm text-link font-medium">
          {dict.vendorOperations.linkFromPayout}
        </Link>
      </div>
      <div className="mt-8">
        <VendorPayoutView locale={locale} ui={ui} />
      </div>
    </main>
  );
}
