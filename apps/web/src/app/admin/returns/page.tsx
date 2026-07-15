import Link from "next/link";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import AdminReturnsList from "./AdminReturnsList";

export default async function AdminReturnsPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminReturns;
  const returnStatus = dict.orderReturnStatus;
  const reasonLabels = dict.orderReturnReason as Record<string, string>;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-5xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <Link href="/dashboard" className="text-sm text-link font-medium">
          {ui.backToDashboard}
        </Link>
      </div>
      <AdminReturnsList
        locale={locale}
        ui={{
          ...ui.list,
          statusLabels: returnStatus as Record<string, string>,
          reasonLabels,
        }}
      />
    </main>
  );
}
