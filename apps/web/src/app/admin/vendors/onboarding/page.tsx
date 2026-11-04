import Link from "next/link";
import AdminOnboardingQueue from "@/app/admin/vendors/onboarding/AdminOnboardingQueue";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";

export default async function AdminVendorOnboardingPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminVendorOnboarding;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-6xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <Link href="/admin/vendors" className="text-sm font-medium text-link">
          {ui.backToVendors}
        </Link>
      </div>
      <AdminOnboardingQueue
        locale={locale}
        ui={{
          loading: ui.loading,
          loadError: ui.loadError,
          empty: ui.empty,
          store: ui.store,
          owner: ui.owner,
          submitted: ui.submitted,
          review: ui.review,
        }}
      />
    </main>
  );
}
