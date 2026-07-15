import VendorDashboardView from "@/app/vendor/VendorDashboardView";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";

export default async function VendorDashboardPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const merged = {
    ...dict.vendorDashboard,
    ...dict.vendorAnalytics,
    productStatusLabels: {
      DRAFT: dict.vendorProducts.statusDraft,
      PENDING: dict.vendorProducts.statusPending,
      PUBLISHED: dict.vendorProducts.statusPublished,
      ON_HOLD: dict.vendorProducts.statusOnHold,
      REJECTED: dict.vendorProducts.statusRejected,
    } as Record<string, string>,
  };
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-6xl p-8 animate-page-enter" dir={direction}>
      <h1 className="text-2xl font-semibold">{merged.title}</h1>
      <p className="mt-2 text-[var(--muted)]">{merged.subtitle}</p>
      <VendorDashboardView locale={locale} ui={merged} />
    </main>
  );
}
