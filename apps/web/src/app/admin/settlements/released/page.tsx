import Link from "next/link";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import AdminReleasedSettlementsPanel from "@/components/admin/AdminReleasedSettlementsPanel";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";

export default async function AdminReleasedSettlementsPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminSettlementsReleased;
  const direction = locale === "ar" ? "rtl" : "ltr";

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

      <div className="mt-8">
        <AdminReleasedSettlementsPanel
          locale={locale}
          ui={{
            ...ui.panel,
            entryTypeLabels: dict.customerCashback.entryTypeLabels as Record<string, string>,
            methodLabels: ui.methodLabels as Record<string, string>,
          }}
        />
      </div>
    </main>
  );
}
