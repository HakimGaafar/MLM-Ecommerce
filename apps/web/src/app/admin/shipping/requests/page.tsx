import AdminShippingRequestsList from "@/app/admin/shipping/requests/AdminShippingRequestsList";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";

export default async function AdminShippingRequestsPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminShippingRequests;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <PageShell dir={direction} maxWidth="5xl">
      <PageHeader title={ui.title} subtitle={ui.subtitle} />
      <AdminShippingRequestsList locale={locale} ui={ui} />
    </PageShell>
  );
}
