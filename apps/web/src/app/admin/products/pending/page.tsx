import Link from "next/link";
import AdminPendingProductsList from "@/app/admin/products/pending/AdminPendingProductsList";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";

export default async function AdminPendingProductsPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = {
    ...dict.adminProductApproval,
    toastApproved: dict.toast.approved,
    toastRejected: dict.toast.rejected,
    toastError: dict.toast.genericError,
  };
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
      <AdminPendingProductsList locale={locale} ui={ui} />
    </main>
  );
}
