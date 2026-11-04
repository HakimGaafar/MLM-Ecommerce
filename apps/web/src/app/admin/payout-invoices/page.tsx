import Link from "next/link";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import AdminPayoutInvoicesList from "./AdminPayoutInvoicesList";

export default async function AdminPayoutInvoicesPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminPayoutInvoices;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-5xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Link href="/admin/withdrawals" className="text-sm font-medium text-link">
            {ui.linkWithdrawals}
          </Link>
          <Link href="/dashboard" className="text-sm font-medium text-link">
            {ui.backToDashboard}
          </Link>
        </div>
      </div>
      <AdminPayoutInvoicesList locale={locale} ui={ui.list} />
    </main>
  );
}
